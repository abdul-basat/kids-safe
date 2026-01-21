// Time restriction overlay component for child viewer

import { useState, useEffect } from 'react';
import { Clock, Moon, Calendar, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { isTimeLimitReached, isWithinAllowedHours, getRemainingTimeToday, formatTimeDisplay } from '../lib/timeTracking';

interface TimeRestrictionOverlayProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export function TimeRestrictionOverlay({ isVisible, onDismiss }: TimeRestrictionOverlayProps) {
  const { settings } = useApp();
  const [timeCheck, setTimeCheck] = useState({
    isTimeLimitReached: false,
    isWithinAllowedHours: true,
    remainingTime: Infinity
  });

  useEffect(() => {
    if (settings && isVisible) {
      const check = {
        isTimeLimitReached: isTimeLimitReached(settings),
        isWithinAllowedHours: isWithinAllowedHours(settings),
        remainingTime: getRemainingTimeToday(settings)
      };
      setTimeCheck(check);
    }
  }, [settings, isVisible]);

  if (!isVisible) return null;

  // Determine which restriction message to show
  if (!timeCheck.isWithinAllowedHours) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-indigo-900 to-purple-900 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Moon className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Bedtime!</h2>
          <p className="text-gray-600 mb-6">
            It's past your bedtime. Time to rest and recharge for tomorrow!
          </p>
          <div className="bg-indigo-50 rounded-xl p-4 mb-6">
            <p className="text-indigo-800 font-medium">
              Watching resumes at {settings?.wake_time_hour}:00
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-colors"
          >
            Okay, I'll rest
          </button>
        </div>
      </div>
    );
  }

  if (timeCheck.isTimeLimitReached) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-amber-900 to-orange-900 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Time's Up!</h2>
          <p className="text-gray-600 mb-6">
            You've reached your daily screen time limit. Great job being responsible!
          </p>
          <div className="bg-amber-50 rounded-xl p-4 mb-6">
            <p className="text-amber-800 font-medium">
              Come back tomorrow for more fun videos!
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors"
          >
            I understand
          </button>
        </div>
      </div>
    );
  }

  // Warning when time is running low
  if (timeCheck.remainingTime < 15 && timeCheck.remainingTime > 0) {
    return (
      <div className="fixed top-4 left-4 right-4 bg-amber-500 text-white rounded-2xl p-4 shadow-lg z-40 animate-pulse">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Time Almost Up!</p>
            <p className="text-sm opacity-90">
              Only {formatTimeDisplay(timeCheck.remainingTime)} remaining
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="text-white hover:text-amber-100 font-bold"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return null;
}