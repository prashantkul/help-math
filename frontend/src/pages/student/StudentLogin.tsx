import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useStudentAuth } from '../../hooks/useAuth';
import { Button, Card, Loading } from '../../components/common';
import { AvatarSelector } from '../../components/common/Avatar';
import { AVATAR_OPTIONS } from '../../types';
import type { AvatarId } from '../../types';

export default function StudentLogin() {
  const navigate = useNavigate();
  const { join, isLoading: authLoading, student } = useStudentAuth();

  const [step, setStep] = useState<'code' | 'passcode' | 'avatar'>('code');
  const [classCode, setClassCode] = useState('');
  const [passcode, setPasscode] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarId>('bear');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [studentName, setStudentName] = useState('');

  // If already logged in, redirect
  if (student && !authLoading) {
    navigate('/student/dashboard');
    return null;
  }

  const handleCodeSubmit = () => {
    if (classCode.length !== 6) {
      setError('The class code has 6 letters/numbers');
      return;
    }
    setError('');
    setStep('passcode');
  };

  const handlePasscodeSubmit = async () => {
    if (passcode.trim().length < 4) {
      setError('Please enter your passcode');
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await join(classCode.toUpperCase(), passcode.trim().toLowerCase());

    if (result.success && result.student) {
      setStudentName(result.student.name);
      setStep('avatar');
    } else {
      setError(result.error || 'Invalid passcode. Ask your teacher for help!');
    }

    setIsLoading(false);
  };

  const handleAvatarSubmit = () => {
    navigate('/student/dashboard');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <Loading message="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex flex-col items-center justify-center p-6">
      {/* Back Button */}
      <div className="absolute top-6 left-6">
        <Button
          variant="ghost"
          onClick={() => {
            if (step === 'passcode') setStep('code');
            else if (step === 'avatar') setStep('passcode');
            else navigate('/');
          }}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back
        </Button>
      </div>

      <Card variant="warm" padding="lg" className="w-full max-w-md">
        {step === 'code' && (
          <>
            <div className="text-center mb-8">
              <span className="text-6xl block mb-4">👋</span>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Welcome!
              </h1>
              <p className="text-gray-600 text-lg">
                Enter your class code
              </p>
              <p className="text-gray-500 text-sm mt-1">
                Ask your teacher for the code!
              </p>
            </div>

            <div className="space-y-6">
              <input
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                className="w-full px-6 py-4 text-3xl font-mono tracking-widest rounded-2xl border-2 border-orange-200 focus:border-orange-400 focus:outline-none text-center uppercase"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCodeSubmit()}
              />

              {error && (
                <p className="text-red-500 text-center">{error}</p>
              )}

              <Button
                variant="secondary"
                size="xl"
                className="w-full"
                onClick={handleCodeSubmit}
                disabled={classCode.length !== 6}
              >
                Next
              </Button>
            </div>
          </>
        )}

        {step === 'passcode' && (
          <>
            <div className="text-center mb-8">
              <span className="text-6xl block mb-4">🔑</span>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Your Passcode
              </h1>
              <p className="text-gray-600 text-lg">
                Enter your personal passcode
              </p>
              <p className="text-gray-500 text-sm mt-1">
                It looks like: bear-1234
              </p>
            </div>

            <div className="space-y-6">
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.toLowerCase())}
                placeholder="bear-1234"
                className="w-full px-6 py-4 text-2xl font-mono rounded-2xl border-2 border-orange-200 focus:border-orange-400 focus:outline-none text-center lowercase"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handlePasscodeSubmit()}
              />

              {error && (
                <p className="text-red-500 text-center">{error}</p>
              )}

              <Button
                variant="secondary"
                size="xl"
                className="w-full"
                onClick={handlePasscodeSubmit}
                disabled={passcode.length < 4 || isLoading}
                isLoading={isLoading}
              >
                Join Class
              </Button>
            </div>
          </>
        )}

        {step === 'avatar' && (
          <>
            <div className="text-center mb-8">
              <span className="text-6xl block mb-4">🎉</span>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Welcome, {studentName}!
              </h1>
              <p className="text-gray-600 text-lg">
                Pick a friend to be your avatar
              </p>
            </div>

            <div className="space-y-6">
              <AvatarSelector
                selectedId={selectedAvatar}
                onSelect={setSelectedAvatar}
              />

              <div className="text-center">
                <p className="text-gray-600">
                  You picked: <strong>{AVATAR_OPTIONS.find(a => a.id === selectedAvatar)?.name}</strong>
                </p>
              </div>

              <Button
                variant="secondary"
                size="xl"
                className="w-full"
                onClick={handleAvatarSubmit}
              >
                Let's Go! 🚀
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
