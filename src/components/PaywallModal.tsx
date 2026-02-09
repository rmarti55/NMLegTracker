"use client";

import { X, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { TOKEN_LIMITS } from "@/lib/config";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokensUsed?: number;
}

export default function PaywallModal({
  isOpen,
  onClose,
  tokensUsed = 0,
}: PaywallModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center">
            <Zap className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Content */}
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
          You&apos;ve used your free tokens
        </h2>
        
        <p className="text-gray-600 text-center mb-4">
          You&apos;ve used {tokensUsed.toLocaleString()} of your{" "}
          {TOKEN_LIMITS.free.toLocaleString()} free tokens. Upgrade to continue
          chatting with your documents.
        </p>

        {/* Token meter */}
        <div className="bg-gray-100 rounded-full h-2 mb-6 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
            style={{ width: "100%" }}
          />
        </div>

        {/* CTA buttons */}
        <div className="space-y-3">
          <Link
            href="/pricing"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            View Plans
            <ArrowRight className="w-4 h-4" />
          </Link>
          
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            Maybe later
          </button>
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Your chat history and documents are saved. Upgrade anytime to continue.
        </p>
      </div>
    </div>
  );
}
