"use client";

import { signIn } from "next-auth/react";
import { X, MessageSquare } from "lucide-react";
import { AI_ASSISTANT } from "@/lib/config";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle?: string;
}

export default function LoginModal({ isOpen, onClose, documentTitle }: LoginModalProps) {
  if (!isOpen) return null;

  // Check if auth bypass is enabled (for preview deployments)
  const bypassAuth = process.env.NEXT_PUBLIC_BYPASS_AUTH === 'true';

  const handleLogin = async () => {
    await signIn("google", { callbackUrl: window.location.href });
  };

  const handlePreviewLogin = async () => {
    await signIn("preview", { callbackUrl: window.location.href });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 relative animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="w-8 h-8 text-white" />
        </div>

        {/* Content */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          Sign in to {AI_ASSISTANT.tagline}
        </h2>
        <p className="text-gray-600 text-center mb-6">
          {documentTitle
            ? `Ask ${AI_ASSISTANT.name} about "${documentTitle}" and get instant answers.`
            : `Sign in to ask ${AI_ASSISTANT.name} questions about documents and legislation.`}
        </p>

        {/* Preview Login Button - only shown when BYPASS_AUTH is enabled */}
        {bypassAuth && (
          <button
            onClick={handlePreviewLogin}
            className="w-full flex items-center justify-center gap-3 bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium mb-3"
          >
            <MessageSquare className="w-5 h-5" />
            Preview Login (No OAuth)
          </button>
        )}

        {/* Google Sign In Button */}
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors font-medium"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign in with Google
        </button>

        {/* Footer text */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Free to use. Your chat history is saved to your account.
        </p>
      </div>
    </div>
  );
}
