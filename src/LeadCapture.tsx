import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { v4 as uuidv4 } from 'uuid';
import { CheckCircle2, Loader2, User, Mail, Phone, Building2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function LeadCapture() {
    const { companyId } = useParams();
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '' });
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            setError('Name is required');
            return;
        }
        setLoading(true);
        setError('');

        try {
            const leadId = uuidv4().slice(0, 8);
            await setDoc(doc(db, 'leads', leadId), {
                id: leadId,
                companyId,
                ...formData,
                source: 'DIRECT',
                leadType: 'B2B',
                health: 'WARM',
                score: 50,
                phase: 'DISCOVERY',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            setSubmitted(true);
        } catch (err: any) {
            console.error("Error creating lead:", err);
            setError("Failed to submit your details. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 p-6 w-full">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-10 rounded-[2.5rem] shadow-xl text-center max-w-md w-full border border-slate-100">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
                        <CheckCircle2 size={36} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Thank You!</h2>
                    <p className="text-slate-500 font-medium">Your information has been successfully received. We will be in touch shortly.</p>
                </motion.div>
            </div>
        );
    }

    const inputClasses = "w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner";
    const labelClasses = "text-[10px] font-black text-slate-400 uppercase tracking-widest px-1";
    const iconClasses = "absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors";

    return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 p-4 sm:p-6 w-full">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-slate-100">
                <div className="mb-8 text-center">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-100 shadow-sm">
                        <User size={20} className="text-indigo-600" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Connect With Us</h2>
                    <p className="text-slate-500 font-medium text-sm leading-relaxed">Please fill out the form below to share your contact information securely.</p>
                </div>

                {error && <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm font-bold border border-rose-100 text-center">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1.5"><label className={labelClasses}>Full Name *</label><div className="relative group"><User className={iconClasses} size={18} /><input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputClasses} placeholder="John Doe" /></div></div>
                    <div className="space-y-1.5"><label className={labelClasses}>Email Address</label><div className="relative group"><Mail className={iconClasses} size={18} /><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={inputClasses} placeholder="john@example.com" /></div></div>
                    <div className="space-y-1.5"><label className={labelClasses}>Phone Number</label><div className="relative group"><Phone className={iconClasses} size={18} /><input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className={inputClasses} placeholder="+1 (555) 000-0000" /></div></div>
                    <div className="space-y-1.5"><label className={labelClasses}>Organization</label><div className="relative group"><Building2 className={iconClasses} size={18} /><input type="text" value={formData.company} onChange={e => setFormData({ ...formData, company: e.target.value })} className={inputClasses} placeholder="Acme Corp" /></div></div>
                    <div className="pt-4"><button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black text-sm hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-indigo-200 disabled:opacity-50">{loading ? <Loader2 size={18} className="animate-spin" /> : null}{loading ? 'Sending...' : 'Submit Information'}</button></div>
                </form>
                <div className="mt-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-widest">Powered by Handysolver CRM</div>
            </motion.div>
        </div>
    );
}