
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        // Automatically bypass login
        toast({
            title: "Bypass Successful",
            description: "Accessing the application directly.",
            variant: "success",
        });
        sessionStorage.setItem('bypass', 'true');
        // Redirect to the dashboard
        router.replace('/dashboard-overview');
    }, [router, toast]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Redirecting to dashboard...</p>
            </div>
        </div>
    );
}
