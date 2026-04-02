import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertCircle, Camera, User, Building2, Mail, Phone, MapPin, Globe, Sparkles, ChevronLeft, Zap, CalendarDays } from 'lucide-react';
import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { CustomFieldDef } from './CustomFields';
import { db } from './firebase';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './contexts/AuthContext';
import { motion } from 'motion/react';

export default function LeadForm({ user }: { user: any }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const { companyId } = useAuth();

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [customPhases, setCustomPhases] = useState<string[]>([]);
  const [customLeadTypes, setCustomLeadTypes] = useState<string[]>([]);

  const [formData, setFormData] = useState<any>({
    name: '',
    email: '',
    company: '',
    location: '',
    phone: '',
    source: 'DIRECT',
    leadType: 'B2B',
    health: 'WARM',
    score: 50,
    phase: 'DISCOVERY',
    avatar: '',
    createdAtStr: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (isEditing && id) {
      const fetchLead = async () => {
        try {
          const docRef = doc(db, 'leads', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            let createdStr = new Date().toISOString().split('T')[0];
            if (data.createdAt?.toDate) {
              const d = data.createdAt.toDate();
              createdStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            }
            setFormData({ avatar: '', ...data, createdAtStr: createdStr } as any);
          } else {
            // Mock data population if it's the dummy IDs, so edit works visually
            if (id === '1') setFormData({ name: 'Alexander Sterling', email: 'a.sterling@vanguard.io', company: 'Vanguard Systems', location: 'London, UK', source: 'LINKEDIN', score: 85, phase: 'QUALIFIED', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' });
            else if (id === '2') setFormData({ name: 'Elena Thorne', email: 'elena.t@atlas.corp', company: 'Atlas Global', location: 'Berlin, DE', source: 'REFERRAL', score: 62, phase: 'NURTURING', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704e' });
            else if (id === '3') setFormData({ name: 'Julian Rossi', email: 'julian@horizon.com', company: 'Horizon Digital', location: 'Milan, IT', source: 'DIRECT', score: 92, phase: 'DISCOVERY', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704f' });
            else if (id === '4') setFormData({ name: 'Sarah Wick', email: 's.wick@continental.dev', company: 'Continental Dev', location: 'New York, US', source: 'LINKEDIN', score: 15, phase: 'INACTIVE', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704g' });
            else setError("Lead details could not be retrieved from the matrix.");
          }
        } catch (err) {
          console.error(err);
          setError("Error fetching lead from secure storage.");
        } finally {
          setLoading(false);
        }
      };
      fetchLead();
    }
  }, [id, isEditing]);

  useEffect(() => {
    if (!companyId) return;
    const q = query(collection(db, 'custom_fields'), where('companyId', '==', companyId));
    getDocs(q).then(snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomFieldDef));
      setCustomFieldDefs(data);
    }).catch(console.error);

    getDoc(doc(db, 'companies', companyId)).then(snap => {
      if (snap.exists()) {
        setCustomSources(snap.data().customSources || []);
        setCustomPhases(snap.data().customPhases || []);
        setCustomLeadTypes(snap.data().customLeadTypes || []);
      }
    }).catch(console.error);
  }, [companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!companyId) throw new Error("Authentication context invalid.");

      const leadId = isEditing ? id : uuidv4();

      let createdTimestamp = Timestamp.now();
      if (formData.createdAtStr) {
        const [y, m, d] = formData.createdAtStr.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        createdTimestamp = Timestamp.fromDate(dateObj);
      }

      const payload = {
        ...formData,
        id: leadId,
        updatedAt: Timestamp.now(),
        createdAt: createdTimestamp,
        companyId: companyId
      };
      delete payload.createdAtStr;

      await setDoc(doc(db, 'leads', leadId as string), payload);
      navigate('/clients');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Protocol failure: Could not commit changes to ledger.");
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'score' ? Number(value) : value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setFormData(prev => ({ ...prev, avatar: canvas.toDataURL('image/jpeg', 0.8) }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center min-h-[100dvh]">
        <Loader2 className="animate-spin text-indigo-500 w-12 h-12" />
      </div>
    );
  }

  const inputClasses = "w-full px-5 py-4 rounded-[1.25rem] border border-slate-200 bg-white focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all font-semibold text-slate-700 shadow-sm placeholder:text-slate-400 placeholder:font-medium";
  const labelClasses = "text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block px-1";

  return (
    <div className="flex-1 bg-[#F9FBFF] text-slate-900 p-4 sm:p-8 lg:p-12 min-h-full font-sans overflow-x-hidden">
      <div className="max-w-4xl mx-auto">

        <Link to="/clients" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-600 transition-all mb-10 group">
          <div className="p-2 bg-white border border-slate-200 rounded-xl group-hover:border-indigo-200 shadow-sm transition-colors">
            <ChevronLeft size={16} />
          </div>
          Back to Intelligence Ledger
        </Link>

        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <div className="text-[10px] font-extrabold text-indigo-500 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
            <Sparkles size={14} className="animate-pulse" /> Asset Modification Protocol
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            {isEditing ? 'Modify Lead' : 'New Lead'}
          </h1>

        </motion.header>

        {error && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-8 p-5 bg-rose-50 text-rose-600 rounded-2xi flex items-center gap-4 text-sm font-bold border border-rose-100 shadow-xl shadow-rose-500/5">
            <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20">
              <AlertCircle size={20} />
            </div>
            {error}
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden relative group">
          {/* Decorative Background Blob */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-bl-[100px] -z-0 pointer-events-none transition-colors group-hover:bg-indigo-100/50"></div>

          <form onSubmit={handleSubmit} className="p-8 sm:p-12 relative z-10">

            {/* Avatar Section */}
            <div className="flex flex-col items-center mb-12">
              <div className="relative group cursor-pointer mb-4">
                <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="w-28 h-28 rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden group-hover:border-indigo-400 transition-all duration-300 relative">
                  {formData.avatar ? (
                    <img src={formData.avatar} alt="Avatar profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-slate-300">
                      <User size={36} />
                      <span className="text-[10px] font-black uppercase tracking-tighter">Image</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-colors flex items-center justify-center pointer-events-none">
                    <Camera className="text-white opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100 duration-300" size={28} />
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity Photo</span>
            </div>

            <div className="space-y-12">

              {/* Primary Identity Section */}
              <section>
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-50">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center"><User size={16} /></div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.15em]">User Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="relative">
                    <label className={labelClasses}>Full Name</label>
                    <div className="relative">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                      <input required type="text" name="name" value={formData.name} onChange={handleChange} className={`${inputClasses} pl-14`} placeholder="e.g. Alexander Sterling" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClasses}>Email</label>
                    <div className="relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                      <input type="email" name="email" value={formData.email} onChange={handleChange} className={`${inputClasses} pl-14`} placeholder="a.sterling@vanguard.io" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Organizational Vector Section */}
              <section>
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-50">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center"><Building2 size={16} /></div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.15em]">Organization Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className={labelClasses}>Organization Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                      <input required type="text" name="company" value={formData.company} onChange={handleChange} className={`${inputClasses} pl-14`} placeholder="Vanguard Systems" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClasses}>Organization Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                      <input type="text" name="location" value={formData.location} onChange={handleChange} className={`${inputClasses} pl-14`} placeholder="London, UK" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClasses}>Mobile Number</label>
                    <div className="relative">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" size={18} />
                      <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className={`${inputClasses} pl-14`} placeholder="+1 234 567 8900" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClasses}>Lead Source</label>
                    <select name="source" value={formData.source} onChange={handleChange} className={inputClasses}>
                      <option value="LINKEDIN">LinkedIn Network</option>
                      <option value="REFERRAL">Internal Referral</option>
                      <option value="DIRECT">Direct Traffic</option>
                      <option value="WEBSITE">Main Terminal (Website)</option>
                      {customSources.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClasses}>Lead Type</label>
                    <select name="leadType" value={formData.leadType || 'B2B'} onChange={handleChange} className={inputClasses}>
                      <option value="B2B">B2B</option>
                      <option value="B2C">B2C</option>
                      <option value="ENTERPRISE">Enterprise</option>
                      {customLeadTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClasses}>Health Stage</label>
                    <select name="health" value={formData.health || 'WARM'} onChange={handleChange} className={inputClasses}>
                      <option value="HOT">HOT</option>
                      <option value="WARM">WARM</option>
                      <option value="COLD">COLD</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Disposition & Scoring Section */}
              <section>
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-50">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center"><Zap className="fill-emerald-500" size={16} /></div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.15em]">Lead Status</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className={labelClasses}>Lead Phase</label>
                    <select name="phase" value={formData.phase} onChange={handleChange} className={inputClasses}>
                      <option value="DISCOVERY">Discovery Protocol</option>
                      <option value="NURTURING">Nurturing Cycle</option>
                      <option value="QUALIFIED">Qualified Status</option>
                      <option value="WON">Closed - Won</option>
                      <option value="LOST">Closed - Lost</option>
                      <option value="INACTIVE">Inactive / Archived</option>
                      {customPhases.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col justify-center">
                    <label className={`${labelClasses} flex justify-between`}>
                      Intrest Level
                      <span className="text-indigo-600 font-black">{formData.score}% Match</span>
                    </label>
                    <div className="px-2 pt-2">
                      <input type="range" name="score" min="0" max="100" value={formData.score} onChange={handleChange} className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 transition-all shadow-inner" />
                      <div className="flex justify-between mt-3 px-1">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Low Intent</span>
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Peak Conversion</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={labelClasses}>Creation Date</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-300 group-focus-within:text-indigo-500 transition-colors"><CalendarDays size={18} /></div>
                      <input type="date" name="createdAtStr" value={formData.createdAtStr || ''} onChange={handleChange} className={`${inputClasses} pl-12`} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Dynamic Logic Matrices (Custom Fields) */}
              {customFieldDefs.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-50">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center"><Globe size={16} /></div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.15em]">Supporting Links</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {customFieldDefs.map(field => (
                      <div key={field.id}>
                        <label className={labelClasses}>{field.name}</label>
                        {field.type === 'DROPDOWN' ? (
                          <select name={field.name} value={formData[field.name] || ''} onChange={handleChange} className={inputClasses}>
                            <option value="">Select Option</option>
                            {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : field.type === 'DATE' ? (
                          <input type="date" name={field.name} value={formData[field.name] || ''} onChange={handleChange} className={inputClasses} />
                        ) : field.type === 'DATETIME' ? (
                          <input type="datetime-local" name={field.name} value={formData[field.name] || ''} onChange={handleChange} className={inputClasses} />
                        ) : (
                          <input type={field.type === 'NUMBER' ? 'number' : 'text'} name={field.name} value={formData[field.name] || ''} onChange={handleChange} className={inputClasses} placeholder={`Enter ${field.name} payload`} />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Form Footer Action Bar */}
            <div className="mt-16 pt-10 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-4">
              <Link to="/clients" className="px-8 py-4 rounded-2xl font-black text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                <ChevronLeft size={18} /> Cancel
              </Link>
              <button type="submit" disabled={saving} className="flex items-center justify-center gap-3 bg-slate-900 text-white px-10 py-4 rounded-2xl font-black hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95 disabled:opacity-50">
                {saving ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Save size={20} className={isEditing ? 'text-indigo-300' : 'text-emerald-300'} />
                )}
                {isEditing ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Informational Footer */}
        <div className="mt-12 text-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
            System Security: All data is encrypted via AES-256 Protocol & Scoped to Company ID: {companyId?.slice(0, 8)}...
          </p>
        </div>

      </div>
    </div>
  );
}
