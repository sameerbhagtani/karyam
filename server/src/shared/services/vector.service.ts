import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Pinecone } from "@pinecone-database/pinecone";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";
import InterviewSessionDao from "../dao/interviewSession.dao.js";
import mistralManager from "./mistralManager.service.js";

interface ChunkRecord {
    text: string;
    sourceType: "resume" | "jd";
    chunkIndex: number;
}

export class VectorService {
    private sessionDao: InterviewSessionDao;
    private pineconeClient: Pinecone | null = null;
    private indexHost?: string;

    constructor() {
        this.sessionDao = new InterviewSessionDao();
        this.indexHost = env.PINECONE_HOST || process.env.PINECONE_HOST || undefined;
    }

    public getPineconeClient(): Pinecone | null {
        const apiKey = env.PINECONE_API_KEY || process.env.PINECONE_API_KEY;
        if (!apiKey) return null;
        if (!this.pineconeClient) {
            this.pineconeClient = new Pinecone({
                apiKey,
            });
        }
        return this.pineconeClient;
    }

    public getIndexName(): string {
        return env.PINECONE_INDEX_NAME || process.env.PINECONE_INDEX_NAME || "karyam-index";
    }

    public getIndex() {
        const pinecone = this.getPineconeClient();
        if (!pinecone) return null;
        const indexName = this.getIndexName();
        return this.indexHost ? pinecone.index(indexName, this.indexHost) : pinecone.index(indexName);
    }

    async chunkText(text: string, sourceType: "resume" | "jd"): Promise<ChunkRecord[]> {
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 50,
        });

        const rawChunks = await splitter.splitText(text);
        return rawChunks.map((chunk, index) => ({
            text: chunk,
            sourceType,
            chunkIndex: index,
        }));
    }

    async processSessionEmbeddings(
        sessionId: string,
        userId: string,
        resumeText: string,
        jdText: string
    ): Promise<void> {
        try {
            logger.info({ sessionId }, "Starting chunking and embedding pipeline for session");

            // 1. Chunk resume and JD text
            const resumeChunks = await this.chunkText(resumeText, "resume");
            const jdChunks = await this.chunkText(jdText, "jd");
            const allChunks = [...resumeChunks, ...jdChunks];

            if (allChunks.length === 0) {
                logger.warn({ sessionId }, "No text chunks generated from resume or JD");
                await this.sessionDao.updateSessionStatus(sessionId, "aborted");
                return;
            }

            // 2. Check if external services are configured
            const pinecone = this.getPineconeClient();
            const indexName = this.getIndexName();
            const hasMistral = mistralManager.hasKeys();

            if (!hasMistral || !pinecone) {
                logger.error(
                    { sessionId, hasMistral, hasPinecone: !!pinecone },
                    "Mistral API keys or PINECONE_API_KEY is not configured. Aborting session per PRD."
                );
                await this.sessionDao.updateSessionStatus(sessionId, "aborted");
                return;
            }

            // 3. Generate embeddings using Mistral via LangChain with automatic key rotation
            const textsToEmbed = allChunks.map((c) => c.text);
            const vectors = await mistralManager.embedDocuments(textsToEmbed);

            // 4. Upsert into Pinecone under session-scoped namespace
            const index = this.getIndex();
            if (!index) {
                logger.error({ sessionId }, "Pinecone index not available for upsert");
                await this.sessionDao.updateSessionStatus(sessionId, "aborted");
                return;
            }
            const records = allChunks.map((chunk, i) => ({
                id: `${sessionId}-${chunk.sourceType}-${chunk.chunkIndex}`,
                values: vectors[i],
                metadata: {
                    sessionId,
                    userId,
                    sourceType: chunk.sourceType,
                    chunkIndex: chunk.chunkIndex,
                    text: chunk.text,
                },
            }));

            // Upsert in batches of 50
            const batchSize = 50;
            for (let i = 0; i < records.length; i += batchSize) {
                const batch = records.slice(i, i + batchSize);
                await index.namespace(sessionId).upsert({ records: batch });
            }

            logger.info(
                { sessionId, totalChunks: records.length, namespace: sessionId, index: indexName },
                "Successfully embedded and upserted vectors to Pinecone"
            );

            // 5. Update session status to ready
            await this.sessionDao.updateSessionStatus(sessionId, "ready");
        } catch (error) {
            logger.error({ error, sessionId }, "Failed to process session embeddings");
            await this.sessionDao.updateSessionStatus(sessionId, "aborted");
        }
    }

    async querySimilarChunks(
        sessionId: string,
        queryText: string,
        topK: number = 4
    ): Promise<Array<{ text: string; sourceType: "resume" | "jd"; score?: number }>> {
        const index = this.getIndex();
        if (!index) {
            logger.warn({ sessionId }, "Pinecone client not configured for similarity search.");
            return [];
        }

        const queryVector = await mistralManager.embedQuery(queryText);
        const response = await index.namespace(sessionId).query({
            vector: queryVector,
            topK,
            includeMetadata: true,
        });

        return (response.matches || []).map((match) => ({
            text: (match.metadata?.text as string) || "",
            sourceType: (match.metadata?.sourceType as "resume" | "jd") || "resume",
            score: match.score,
        }));
    }
}

export const vectorService = new VectorService();
export default vectorService;
