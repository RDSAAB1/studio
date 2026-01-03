import type { ReactNode } from "react";

export type PageMeta = {
    title: string;
    description?: string;
    icon?: ReactNode;
}

export interface PageProps {
    params: Promise<{ [key: string]: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined };
}

export type PageLayoutProps = {
    children: ReactNode;
    pageMeta?: PageMeta;
}
