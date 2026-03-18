import { useListAnalyses, useDeleteAnalysis } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, Badge, Button } from "@/components/ui-elements";
import { FileText, Trash2, ArrowRight, Clock } from "lucide-react";
import { useState } from "react";

export default function History() {
  const { data, isLoading } = useListAnalyses();
  const deleteMutation = useDeleteAnalysis();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this analysis?")) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ analysisId: id });
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const analyses = data?.analyses || [];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6 pt-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Analysis History</h1>
          <p className="text-muted-foreground">Review and manage your past document analyses.</p>
        </div>
      </div>

      {analyses.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center">
          <Clock className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-xl font-semibold text-white mb-2">No history yet</h3>
          <p className="text-muted-foreground mb-6">Upload your first document to see it here.</p>
          <Link href="/">
            <Button>Upload Document</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4">
          {analyses.map((item) => (
            <Card key={item.analysisId} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group hover:border-white/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-secondary rounded-xl group-hover:bg-primary/10 transition-colors">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-primary transition-colors">
                    <Link href={`/analysis/${item.analysisId}`}>{item.documentName}</Link>
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span>{format(new Date(item.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="uppercase text-xs tracking-wider">{item.documentType.replace('-', ' ')}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <Badge variant={item.status === 'completed' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'} className="text-[10px]">
                      {item.status}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t border-white/5 sm:border-0">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(item.analysisId)}
                  disabled={deletingId === item.analysisId}
                >
                  {deletingId === item.analysisId ? "Deleting..." : <Trash2 className="w-4 h-4" />}
                </Button>
                <Link href={`/analysis/${item.analysisId}`} className="flex-1 sm:flex-none">
                  <Button variant="secondary" size="sm" className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
                    View Results <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
