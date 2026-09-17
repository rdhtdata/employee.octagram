import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { useNotification } from '../../context/NotificationContext.js';
import { Sparkles, Lock, Mail } from 'lucide-react';
import { Button } from '../../components/common/Button.js';
import { Modal } from '../../components/common/Modal.js';

export const Login: React.FC<{ onLoginSuccess?: () => void }> = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const { showToast } = useNotification();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await login({ email, password });
      showToast('Signed in successfully', 'success');
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      const msg = err.message || 'Invalid email or password. Please try again.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetSent(true);
    showToast('Password reset link sent to your registered email.', 'info');
  };

  return (
    <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center p-4 selection:bg-zinc-800">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md mb-2 text-zinc-100">
            <Sparkles className="w-5 h-5 text-zinc-300" />
          </div>
          <h1 className="text-lg font-bold tracking-widest text-zinc-100 uppercase">OCTAGRAM</h1>
          <p className="text-xs text-zinc-400 font-normal">Internal Operations Hub</p>
        </div>

        {/* Login Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
              <span className="font-semibold">Error:</span> {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Email or Username</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="name@octagramai.com or username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-300">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetSent(false);
                    setIsForgotModalOpen(true);
                  }}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all font-mono"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>
        </div>

        {/* Footer Subtext */}
        <p className="text-center text-[11px] text-zinc-600">
          Protected Octagram Internal Workspace • hub.octagramai.com
        </p>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Reset Account Password"
        maxWidth="sm"
      >
        <div className="space-y-4 py-1 text-xs">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-zinc-100 font-semibold">
              <Lock className="w-4 h-4 text-purple-400" /> Password Recovery Protocol
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              For security and internal access governance, password resets are managed directly by the developer.
            </p>
            <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-lg space-y-1.5">
              <p className="text-[11px] text-zinc-400 font-medium">Please contact:</p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span>Harsh Tripathi</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-purple-950 text-purple-400 border border-purple-800 rounded font-mono font-bold">DEV</span>
                </span>
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono">
                <a
                  href="mailto:harsh@octagramai.com?subject=Octagram%20Hub%20Password%20Reset"
                  className="text-sky-400 hover:text-sky-300 flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  <span>harsh@octagramai.com</span>
                </a>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-zinc-800">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsForgotModalOpen(false)}
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
