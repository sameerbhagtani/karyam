export type JobPlatform = "LinkedIn" | "Indeed" | "Glassdoor" | "ZipRecruiter" | "Other";

export interface JobListing {
    id: string;
    title: string;
    company: string;
    companyLogo?: string | null;
    location: string;
    isRemote: boolean;
    employmentType: string;
    sourcePlatform: JobPlatform;
    applyUrl: string;
    description: string;
    highlights?: string[];
    postedAt?: string | null;
    salarySnippet?: string | null;
}

export interface JobSearchQuery {
    query: string;
    location?: string;
    limit?: number;
}

export interface JobPreparePayload {
    title: string;
    company: string;
    description: string;
    applyUrl?: string;
    sourcePlatform?: string;
}

export interface JobPrepareResponse {
    jdId: string;
    message: string;
}
