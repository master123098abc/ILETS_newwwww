import React, { useState, useEffect } from 'react';
import { History, Award, CheckCircle, Clock, ChevronLeft } from 'lucide-react';

export function TestHistory({ onBack }: { onBack: () => void }) {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    try {
      const data = localStorage.getItem('ielts_history');
      if (data) {
        setHistory(JSON.parse(data));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  return (
    <div className="animate-in fade-in duration-500 bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100 min-h-[500px]">
      <div className="flex items-center gap-4 mb-10 border-b border-gray-100 pb-6">
        <button 
           onClick={onBack}
           className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
             <History className="w-8 h-8 text-indigo-600" />
             Test History
          </h2>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
           <Award className="w-16 h-16 mx-auto mb-4 opacity-20" />
           <p className="text-xl font-medium">No test history found.</p>
           <p className="mt-2 text-sm">Complete a test to see your score here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((record: any) => (
            <div key={record.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-shadow">
               <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-white px-3 py-1 rounded-md text-xs font-bold uppercase tracking-widest text-indigo-600 border border-indigo-100 shadow-sm">
                       {record.section}
                    </span>
                    <span className="text-sm font-medium text-slate-500 border border-slate-200 px-3 py-1 bg-white rounded-md uppercase">
                       {record.testMode || 'full'}
                    </span>
                  </div>
                  <div className="text-slate-600 text-sm flex items-center gap-2 font-medium">
                    <Clock className="w-4 h-4 text-slate-400" />
                    {new Date(record.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
               </div>
               
               <div className="flex items-center gap-6 bg-white py-4 px-6 rounded-xl border border-gray-100 shadow-sm">
                  {record.type === 'objective' ? (
                     <>
                        <div className="text-center border-r border-gray-100 pr-6">
                           <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Score</div>
                           <div className="text-2xl font-black text-slate-800">{record.correct}/{record.total}</div>
                        </div>
                        <div className="text-center min-w-[80px]">
                           <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Band</div>
                           <div className="text-3xl font-black text-indigo-600">{record.band?.toFixed(1) || 'N/A'}</div>
                        </div>
                     </>
                  ) : (
                     <div className="text-center min-w-[80px]">
                        <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Overall Band</div>
                        <div className="text-3xl font-black text-indigo-600">{record.band?.toFixed(1) || 'N/A'}</div>
                     </div>
                  )}
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
