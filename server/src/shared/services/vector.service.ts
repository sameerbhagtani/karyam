import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MistralAIEmbeddings } from "@langchain/mistralai";
import { Pinecone } from "@pinecone-database/pinecone";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";
import InterviewSessionDao from "../dao/interviewSession.dao.js";

interface ChunkRecord {
    text: string;
    sourceType: "resume" | "jd";
    chunkIndex: number;
}

export class VectorService {
    private sessionDao: InterviewSessionDao;
    private pineconeClient: Pinecone | null = null;
    private embeddings: MistralAIEmbeddings | null = null;
    private indexName: string;

    constructor() {
        this.sessionDao = new InterviewSessionDao();
        this.indexName = env.PINECONE_INDEX_NAME || "karyam-index";

        if (env.MISTRAL_API_KEY) {
            this.embeddings = new MistralAIEmbeddings({
                apiKey: env.MISTRAL_API_KEY,
                model: "mistral-embed",
            });
        }

        if (env.PINECONE_API_KEY) {
            this.pineconeClient = new Pinecone({
                apiKey: env.PINECONE_API_KEY,
            });
        }
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

            // 2. Check if external services are configured
            if (!this.embeddings || !this.pineconeClient || !env.PINECONE_API_KEY || !env.MISTRAL_API_KEY) {
                logger.warn(
                    { sessionId },
                    "MISTRAL_API_KEY or PINECONE_API_KEY is not configured. Stubbing vector upsert and transitioning session to 'ready'."
                );
                await this.sessionDao.updateSessionStatus(sessionId, "ready");
                return;
            }

            // 3. Generate embeddings using Mistral via LangChain
            const textsToEmbed = allChunks.map((c) => c.text);
            const vectors = await this.embeddings.embedDocuments(textsToEmbed);

            // 4. Upsert into Pinecone under session-scoped namespace
            const index = this.pineconeClient.index(this.indexName);
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
                { sessionId, totalChunks: records.length, namespace: sessionId },
                "Successfully embedded and upserted vectors to Pinecone"
            );

            // 5. Update session status to ready
            await this.sessionDao.updateSessionStatus(sessionId, "ready");
        } catch (error) {
            logger.error({ error, sessionId }, "Failed to process session embeddings");
            await this.sessionDao.updateSessionStatus(sessionId, "aborted");
        }
    }
}

export const vectorService = new VectorService();
export default vectorService;
