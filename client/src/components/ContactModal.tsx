import React, { useState } from 'react';
import api, { getErrorMessage } from '../api';
import toast from 'react-hot-toast';
import {
  XMarkIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingStorefrontIcon,
  UserIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  restaurant_name: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  restaurant_name?: string;
  message?: string;
}

const INITIAL_FORM: FormData = {
  name: '',
  email: '',
  phone: '',
  restaurant_name: '',
  message: '',
};

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (!form.name.trim() || form.name.trim().length < 2) {
      errs.name = 'Name must be at least 2 characters.';
    }
    if (!form.email.trim()) {
      errs.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (form.phone.trim() && !/^[+]?[\d\s()-]{7,15}$/.test(form.phone.trim())) {
      errs.phone = 'Please enter a valid phone number.';
    }
    if (form.restaurant_name.trim() && form.restaurant_name.trim().length < 2) {
      errs.restaurant_name = 'Restaurant name must be at least 2 characters.';
    }
    if (form.message.trim() && form.message.trim().length > 1000) {
      errs.message = 'Message must be under 1000 characters.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await api.post('/admin/contact', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        restaurant_name: form.restaurant_name.trim() || undefined,
        message: form.message.trim() || undefined,
      });
      setSubmitted(true);
      toast.success('Thank you! We\'ll get back to you within 24 hours.');
    } catch (err: any) {
      const msg = getErrorMessage(err);
      toast.error(msg || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setSubmitted(false);
    onClose();
  };

  const inputClass = (field: keyof FormErrors) =>
    `w-full bg-[#0f172a] border ${
      errors[field]
        ? 'border-red-500/50 focus:border-red-400 focus:ring-red-500/20'
        : 'border-white/[0.08] focus:border-[#3b82f6]/50 focus:ring-[#3b82f6]/20'
    } rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 transition-all duration-200`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#030712] shadow-2xl shadow-black/50 animate-fade-in-up">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-white/[0.06] bg-[#030712]/95 backdrop-blur-xl rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center">
              <SparklesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Book a Demo</h2>
              <p className="text-xs text-slate-500">We'll get back to you within 24 hours</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg border border-white/[0.06] flex items-center justify-center text-slate-400 hover:text-white hover:border-white/[0.14] transition-all"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {submitted ? (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#06b6d4]/20 to-[#3b82f6]/20 border border-[#06b6d4]/20 flex items-center justify-center mb-5">
              <CheckBadgeIcon className="w-8 h-8 text-[#06b6d4]" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Request Submitted!</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto mb-6">
              Our team will review your details and reach out within 24 hours to schedule your personalized demo.
            </p>
            <button
              onClick={handleClose}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Full Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  className={`${inputClass('name')} pl-10`}
                  placeholder="Rajesh Kumar"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  maxLength={100}
                />
              </div>
              {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Work Email <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="email"
                  className={`${inputClass('email')} pl-10`}
                  placeholder="owner@restaurant.com"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Phone <span className="text-slate-600">(optional)</span>
              </label>
              <div className="relative">
                <PhoneIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="tel"
                  className={`${inputClass('phone')} pl-10`}
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  maxLength={20}
                />
              </div>
              {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
            </div>

            {/* Restaurant Name */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Restaurant Name <span className="text-slate-600">(optional)</span>
              </label>
              <div className="relative">
                <BuildingStorefrontIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="text"
                  className={`${inputClass('restaurant_name')} pl-10`}
                  placeholder="Spice Garden"
                  value={form.restaurant_name}
                  onChange={(e) => handleChange('restaurant_name', e.target.value)}
                  maxLength={255}
                />
              </div>
              {errors.restaurant_name && <p className="mt-1 text-xs text-red-400">{errors.restaurant_name}</p>}
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Message <span className="text-slate-600">(optional)</span>
              </label>
              <textarea
                className={`${inputClass('message')} resize-none`}
                rows={3}
                placeholder="Tell us about your restaurant and what you're looking for..."
                value={form.message}
                onChange={(e) => handleChange('message', e.target.value)}
                maxLength={1000}
              />
              <div className="flex justify-between mt-1">
                {errors.message ? (
                  <p className="text-xs text-red-400">{errors.message}</p>
                ) : (
                  <span />
                )}
                <span className="text-[10px] text-slate-600">{form.message.length}/1000</span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] text-white font-semibold text-sm hover:shadow-lg hover:shadow-[#3b82f6]/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="w-4 h-4" />
                  Submit Request
                </>
              )}
            </button>

            <p className="text-[11px] text-slate-600 text-center">
              By submitting, you agree to our{' '}
              <a href="#" className="text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors">
                Privacy Policy
              </a>{' '}
              and consent to being contacted about AuraOS.
            </p>
          </form>
        )}

        {/* Footer glow accent */}
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#3b82f6]/30 to-transparent" />
      </div>
    </div>
  );
};

export default ContactModal;
