import { CheckCircle2, ExternalLink, Calendar, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ReraProject {
  project_name: string;
  rera_number: string;
  developer: string;
  location: string;
  registered_date: string;
  status: string;
  type: string;
  units: number;
}

interface ReraResultCardProps {
  project: ReraProject;
}

export function ReraResultCard({ project }: ReraResultCardProps) {
  const isCompleted = project.status === "Completed";

  return (
    <div className="bg-surface border border-border rounded-xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <CheckCircle2 className="w-6 h-6 text-[#437a22] flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs text-[#437a22] font-semibold bg-[#d8f0c8] dark:bg-[#1a2e10] px-2 py-0.5 rounded-full">
                RERA Registered
              </span>
              <h3 className="font-semibold text-foreground mt-1.5">
                {project.project_name}
              </h3>
            </div>
            <Badge
              className={`text-xs flex-shrink-0 ${
                isCompleted
                  ? "bg-muted text-muted-foreground hover:bg-muted"
                  : "bg-[#d0e8da] text-[#1a5c3a] dark:bg-[#1a3528] dark:text-[#6fbc3a] hover:bg-[#d0e8da]"
              }`}
            >
              {project.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <p className="text-xs text-muted-foreground">RERA Number</p>
          <p className="font-mono text-xs font-medium break-all">
            {project.rera_number}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Developer</p>
          <p className="font-medium">{project.developer}</p>
        </div>
        <div className="flex items-start gap-1">
          <div>
            <p className="text-xs text-muted-foreground">Location</p>
            <p className="font-medium">{project.location}</p>
          </div>
        </div>
        <div className="flex items-start gap-1">
          <div>
            <p className="text-xs text-muted-foreground">Registered On</p>
            <p className="font-medium flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(project.registered_date).toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Type</p>
          <p className="font-medium">{project.type}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Units</p>
          <p className="font-medium flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {project.units.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <Button
        asChild
        variant="outline"
        size="sm"
        className="w-full text-xs"
      >
        <a
          href="https://rera.karnataka.gov.in/projectDetails"
          target="_blank"
          rel="noopener noreferrer"
        >
          View on RERA Karnataka
          <ExternalLink className="w-3 h-3 ml-1" />
        </a>
      </Button>
    </div>
  );
}
