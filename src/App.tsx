/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen } from 'lucide-react';
import { ExamMode } from './components/ExamMode';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-white shadow-sm border border-gray-100 text-indigo-600 mb-2">
              <BookOpen className="w-8 h-8" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
              IELTS Engine
            </h1>
            <p className="text-gray-500 max-w-xl text-lg">
              Official CD-IELTS Environment Simulator
            </p>
          </div>
        </header>

        <ExamMode />
      </div>
    </div>
  );
}
