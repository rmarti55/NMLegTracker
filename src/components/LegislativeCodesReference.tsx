"use client";

import { useState, useMemo } from "react";
import { X, Search, HelpCircle } from "lucide-react";
import { getAllCodes } from "@/lib/legislative-codes";

interface LegislativeCodesReferenceProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'actions' | 'committees';

export default function LegislativeCodesReference({ isOpen, onClose }: LegislativeCodesReferenceProps) {
  const [activeTab, setActiveTab] = useState<TabType>('actions');
  const [searchQuery, setSearchQuery] = useState("");
  
  const allCodes = useMemo(() => getAllCodes(), []);
  
  // Filter codes based on search query
  const filteredActions = useMemo(() => {
    if (!searchQuery) return allCodes.actions;
    const query = searchQuery.toLowerCase();
    return allCodes.actions.filter(
      item => 
        item.code.toLowerCase().includes(query) ||
        item.short.toLowerCase().includes(query) ||
        item.full.toLowerCase().includes(query)
    );
  }, [allCodes.actions, searchQuery]);
  
  const filteredCommittees = useMemo(() => {
    if (!searchQuery) return allCodes.committees;
    const query = searchQuery.toLowerCase();
    return allCodes.committees.filter(
      item => 
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query)
    );
  }, [allCodes.committees, searchQuery]);
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-4 md:inset-8 lg:inset-y-8 lg:inset-x-32 xl:inset-x-64 bg-white shadow-xl z-50 flex flex-col rounded-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <HelpCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Legislative Codes Reference</h2>
              <p className="text-sm text-gray-500">New Mexico Legislature abbreviations and their meanings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Search and Tabs */}
        <div className="px-6 py-4 border-b border-gray-200 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search codes or descriptions..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('actions')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'actions'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Action Codes ({filteredActions.length})
            </button>
            <button
              onClick={() => setActiveTab('committees')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'committees'
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Committee Codes ({filteredCommittees.length})
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'actions' && (
            <div className="space-y-2">
              {filteredActions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No matching action codes found</p>
              ) : (
                filteredActions.map((item) => (
                  <div 
                    key={item.code}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <code className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-mono font-semibold whitespace-nowrap">
                        {item.code}
                      </code>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{item.short}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{item.full}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          
          {activeTab === 'committees' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filteredCommittees.length === 0 ? (
                <p className="text-center text-gray-500 py-8 col-span-2">No matching committee codes found</p>
              ) : (
                filteredCommittees.map((item) => (
                  <div 
                    key={item.code}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <code className={`px-2 py-1 rounded text-sm font-mono font-semibold whitespace-nowrap ${
                        item.code.startsWith('H') 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {item.code}
                      </code>
                      <span className="text-gray-700 text-sm truncate" title={item.name}>
                        {item.name}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Source: <a 
              href="https://www.nmlegis.gov/Legislation/Key_To_Abbreviations" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              NM Legislature Key to Abbreviations
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

// Button component to open the reference modal
export function LegislativeCodesHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      title="View legislative codes reference"
    >
      <HelpCircle className="w-4 h-4" />
      <span>Code Reference</span>
    </button>
  );
}
