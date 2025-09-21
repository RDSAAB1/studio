import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TriangleAlert } from "lucide-react";

export default function PlaceholderPage({ title, message }: { title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex flex-col items-center gap-4 font-headline text-2xl">
            <TriangleAlert className="h-12 w-12 text-accent" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {message || "This feature is currently under construction. Please check back later."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
