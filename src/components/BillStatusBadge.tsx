"use client";

interface BillStatusBadgeProps {
  status: number;
  size?: "sm" | "md" | "lg";
  showDescription?: boolean;
}

const STATUS_CONFIG: Record<number, { label: string; color: string; bg: string; description: string }> = {
  1: { 
    label: "In Committee", 
    color: "text-blue-700", 
    bg: "bg-blue-100",
    description: "Being reviewed by committee"
  },
  2: { 
    label: "Passed One Chamber", 
    color: "text-yellow-700", 
    bg: "bg-yellow-100",
    description: "Heading to the other chamber"
  },
  3: { 
    label: "Passed Both Chambers", 
    color: "text-purple-700", 
    bg: "bg-purple-100",
    description: "Waiting for Governor's signature"
  },
  4: { 
    label: "Signed Into Law", 
    color: "text-green-700", 
    bg: "bg-green-100",
    description: "Signed by the Governor"
  },
  5: { 
    label: "Vetoed", 
    color: "text-red-700", 
    bg: "bg-red-100",
    description: "Rejected by the Governor"
  },
  6: { 
    label: "Did Not Pass", 
    color: "text-gray-700", 
    bg: "bg-gray-100",
    description: "Failed to advance"
  },
};

export default function BillStatusBadge({ status, size = "md", showDescription = true }: BillStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { 
    label: `Status ${status}`, 
    color: "text-gray-700", 
    bg: "bg-gray-100",
    description: "Unknown status"
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };

  const descriptionSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  // When showing description inline, no need for tooltip or cursor-help
  if (showDescription) {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.color} ${sizeClasses[size]}`}
        >
          {config.label}
        </span>
        <span className={`text-gray-500 ${descriptionSizeClasses[size]}`}>
          {config.description}
        </span>
      </span>
    );
  }

  // Just show the badge without description
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.color} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  );
}

export function getStatusLabel(status: number): string {
  return STATUS_CONFIG[status]?.label || `Status ${status}`;
}
