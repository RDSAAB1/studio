import type { ReactNode } from "react";

export type PageMeta = {
    title: string;
    description?: string;
    icon?: ReactNode;
}

export interface PageProps {
    params: { [key: string]: string };
    searchParams?: { [key: string]: string | string[] | undefined };
}

export type PageLayoutProps = {
    children: ReactNode;
    pageMeta?: PageMeta;
}
