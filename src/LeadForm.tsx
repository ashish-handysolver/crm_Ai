import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertCircle, Camera, User, Building2, Mail, Phone, MapPin, Globe, Sparkles, ChevronLeft, Zap, CalendarDays, ShieldAlert, UserCircle } from 'lucide-react';
import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { CustomFieldDef } from './CustomFields';
import { db } from './firebase';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './contexts/AuthContext';
import { logActivity } from './utils/activity';
import { motion } from 'motion/react';

export default function LeadForm({ user }: { user: any }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const [originalLead, setOriginalLead] = useState<any>(null);
  const { companyId, role, user: authUser } = useAuth();

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [customPhases, setCustomPhases] = useState<string[]>([]);
  const [customLeadTypes, setCustomLeadTypes] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const [formData, setFormData] = useState<any>({
    name: '',
    email: '',
    company: '',
    location: '',
    phone: '',
    source: 'DIRECT',
    leadType: String((import.meta as any).env.VITE_DEFAULT_LEAD_TYPE || 'B2B').trim(),
    health: String((import.meta as any).env.VITE_DEFAULT_HEALTH || 'WARM').trim(),
    score: 50,
    phase: String((import.meta as any).env.VITE_DEFAULT_PHASE || 'DISCOVERY').trim(),
    avatar: '',
    assignedTo: user?.uid || '',
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
            setOriginalLead({ ...data });
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

    const qUsers = query(collection(db, 'users'), where('companyId', '==', companyId));
    getDocs(qUsers).then(snap => {
      setTeamMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
        isInterested: formData.isInterested ?? true,
        updatedAt: Timestamp.now(),
        createdAt: createdTimestamp,
        companyId: companyId
      };
      delete payload.createdAtStr;

      // Log changes if editing
      if (isEditing && originalLead) {
        const trackedFields = ['phase', 'status', 'health', 'assignedTo', 'isInterested'];
        for (const field of trackedFields) {
          const oldVal = originalLead[field];
          const newVal = payload[field];
          if (oldVal !== newVal) {
            await logActivity({
              leadId: leadId as string,
              companyId: companyId,
              type: field === 'isInterested' ? 'INTEREST_CHANGE' : 'FIELD_CHANGE',
              action: `Updated ${field.charAt(0).toUpperCase() + field.slice(1)}`,
              authorUid: authUser.uid,
              authorName: authUser.displayName || 'System',
              details: {
                field: field,
                oldValue: oldVal ?? (field === 'isInterested' ? true : 'NONE'),
                newValue: newVal ?? (field === 'isInterested' ? true : 'NONE')
              }
            });
          }
        }
      } else if (!isEditing) {
        await logActivity({
          leadId: leadId as string,
          companyId: companyId,
          type: 'SYSTEM',
          action: 'Lead Created',
          authorUid: authUser.uid,
          authorName: authUser.displayName || 'System'
        });
      }

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
      <div className="flex-1 bg-transparent min-h-screen overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-8 lg:p-12 space-y-8 animate-pulse">
          <div className="w-32 h-6 bg-white/10 rounded"></div>
          <div className="space-y-4">
            <div className="w-48 h-6 bg-white/10 rounded-full"></div>
            <div className="w-64 sm:w-96 h-10 sm:h-12 bg-white/10 rounded-xl"></div>
            <div className="w-full max-w-2xl h-4 bg-white/10 rounded"></div>
          </div>
          <div className="h-[800px] bg-white/5 rounded-[2.5rem] border border-white/10"></div>
        </div>
      </div>
    );
  }

  const inputClasses = "w-full px-5 py-4 rounded-[1.25rem] border border-white/10 bg-black/20 focus:bg-black/40 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-white shadow-inner placeholder:text-slate-500 placeholder:font-medium";
  const labelClasses = "text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5 block px-1";

  return (
    <>
      <div className="flex-1 bg-transparent min-h-screen overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-8 lg:p-12 space-y-8">

          {/* Back Link */}
          <Link to="/clients" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-400 transition-all group w-fit">
            <div className="p-2 bg-white/5 border border-white/10 rounded-xl group-hover:border-indigo-500/30 group-hover:bg-indigo-500/20 shadow-sm transition-all text-white">
              <ChevronLeft size={16} />
            </div>
            Return to Leads
          </Link>

          {/* Header */}
          <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
              <Sparkles size={14} className="animate-pulse" /> Client Profile
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
              {isEditing ? 'Edit Existing Lead' : 'Add New Lead'}
            </h1>
            <p className="text-slate-400 font-medium max-w-2xl">
              {isEditing ? 'Modify the information for this lead to maintain an accurate business pipeline.' : 'Enter the details for your new lead to begin tracking their progress through the sales funnel.'}
            </p>
          </motion.header>

          {error && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-5 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center gap-4 text-sm font-bold border border-rose-500/20 shadow-xl shadow-rose-500/10">
              <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20">
                <AlertCircle size={20} />
              </div>
              {error}
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card !bg-slate-900/40 !border-white/10 !rounded-[2.5rem] overflow-hidden relative shadow-2xl">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3"></div>
            <form onSubmit={handleSubmit} className="p-8 sm:p-12 space-y-12 relative z-10">

              {/* Avatar Section */}
              <div className="flex flex-col items-center pb-12 border-b border-white/10">
                <div className="relative group cursor-pointer mb-5">
                  <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="w-32 h-32 rounded-[2.5rem] border-2 border-dashed border-white/20 flex items-center justify-center bg-black/20 overflow-hidden group-hover:border-indigo-500 group-hover:bg-indigo-500/10 transition-all duration-300 relative shadow-inner">
                    {formData.avatar ? (
                      <img src={formData.avatar} alt="Avatar profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-500 group-hover:text-indigo-300 transition-colors">
                        <User size={40} />
                        <span className="text-[10px] font-black uppercase tracking-tighter">Add Photo</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/20 transition-colors flex items-center justify-center pointer-events-none">
                      <Camera className="text-white opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100 duration-300" size={28} />
                    </div>
                  </div>
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Profile Identity</h3>
              </div>

              <div className="space-y-14">

                {/* Personal Information */}
                <section className="space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-sm border border-indigo-500/30">
                      <User size={18} />
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">Core Information</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className={labelClasses}>Full Name</label>
                      <div className="relative group">
                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        <input required type="text" name="name" value={formData.name} onChange={handleChange} className={`${inputClasses} pl-14`} placeholder="e.g. John Smith" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClasses}>Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className={`${inputClasses} pl-14`} placeholder="john.s@example.com" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClasses}>Phone Number</label>
                      <div className="relative group">
                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className={`${inputClasses} pl-14`} placeholder="+1 234 567 890" />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Company Information */}
                <section className="space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-sm border border-indigo-500/30">
                      <Building2 size={18} />
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">Company Details</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className={labelClasses}>Company Name</label>
                      <div className="relative group">
                        <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        <input required type="text" name="company" value={formData.company} onChange={handleChange} className={`${inputClasses} pl-14`} placeholder="Acme Inc." />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClasses}>Office Location</label>
                      <div className="relative group">
                        <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        <input type="text" name="location" value={formData.location} onChange={handleChange} className={`${inputClasses} pl-14`} placeholder="San Francisco, CA" />
                      </div>
                    </div>
                  </div>
                </section>
                
                {/* Assignment Section */}
                {(role !== 'team_member' || !isEditing) && (
                  <section className="space-y-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-sm border border-indigo-500/30">
                        <UserCircle size={18} />
                      </div>
                      <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">Owner & Assignment</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className={labelClasses}>Assigned Representative</label>
                        <select 
                          name="assignedTo" 
                          value={formData.assignedTo || ''} 
                          onChange={handleChange} 
                          disabled={role === 'team_member'}
                          className={`${inputClasses} appearance-none [&>option]:bg-slate-900`}
                        >
                          <option value="">— Unassigned —</option>
                          {teamMembers.map(m => (
                            <option key={m.id} value={m.id}>{m.displayName || m.email} ({m.role})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>
                )}

                {/* Classification */}
                <section className="space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-sm border border-indigo-500/30">
                      <Zap size={18} />
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">Pipeline & Classification</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className={labelClasses}>Lead Source</label>
                      <div className="relative group">
                        <input name="source" value={formData.source} onChange={handleChange} list="sources" className={inputClasses} placeholder="Select or type..." />
                        <datalist id="sources">
                          <option value="LINKEDIN">LinkedIn</option>
                          <option value="REFERRAL">Referral</option>
                          <option value="DIRECT">Direct</option>
                          {customSources.map(s => <option key={s} value={s}>{s}</option>)}
                        </datalist>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClasses}>Lead Type</label>
                      <select name="leadType" value={formData.leadType || String((import.meta as any).env.VITE_DEFAULT_LEAD_TYPE || 'B2B').trim()} onChange={handleChange} className={`${inputClasses} appearance-none [&>option]:bg-slate-900`}>
                        {String((import.meta as any).env.VITE_LEAD_TYPES || 'B2B,B2C,ENTERPRISE').split(',').map(t => {
                          const val = t.trim();
                          return <option key={val} value={val}>{val}</option>;
                        })}
                        {customLeadTypes.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClasses}>Pipeline Phase</label>
                      <select name="phase" value={formData.phase} onChange={handleChange} className={`${inputClasses} appearance-none [&>option]:bg-slate-900`}>
                        {String((import.meta as any).env.VITE_PIPELINE_STAGES || 'DISCOVERY,CONNECTED,NURTURING,QUALIFIED,WON,LOST,INACTIVE').split(',').map(p => {
                          const val = p.trim();
                          return <option key={val} value={val}>{val.charAt(0) + val.slice(1).toLowerCase()}</option>;
                        })}
                        {customPhases.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClasses}>Health Status</label>
                      <select name="health" value={formData.health} onChange={handleChange} className={`${inputClasses} appearance-none [&>option]:bg-slate-900`}>
                        {String((import.meta as any).env.VITE_HEALTH_STATUSES || 'HOT,WARM,COLD').split(',').map(h => {
                          const val = h.trim();
                          return <option key={val} value={val}>{val.charAt(0) + val.slice(1).toLowerCase()}</option>;
                        })}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className={`${labelClasses} flex justify-between`}>
                        AI Confidence Score
                        <span className="text-indigo-400 font-black">{formData.score}% Match</span>
                      </label>
                      <div className="pt-2">
                        <input type="range" name="score" min="0" max="100" value={formData.score} onChange={handleChange} className="w-full h-2 bg-black/40 border border-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all shadow-inner" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClasses}>Capture Date</label>
                      <div className="relative group">
                        <CalendarDays className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                        <input type="date" name="createdAtStr" value={formData.createdAtStr || ''} onChange={handleChange} className={`${inputClasses} pl-14 [color-scheme:dark]`} />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Custom Fields */}
                {customFieldDefs.length > 0 && (
                  <section className="space-y-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-sm border border-indigo-500/30">
                        <Globe size={18} />
                      </div>
                      <h3 className="text-sm font-black text-white uppercase tracking-[0.1em]">Extended Fields</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {customFieldDefs.map(field => (
                        <div key={field.id} className="space-y-2">
                          <label className={labelClasses}>{field.name}</label>
                          {field.type === 'DROPDOWN' ? (
                            <select name={field.name} value={formData[field.name] || ''} onChange={handleChange} className={`${inputClasses} appearance-none [&>option]:bg-slate-900`}>
                              <option value="">Select Option</option>
                              {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : field.type === 'DATE' ? (
                            <input type="date" name={field.name} value={formData[field.name] || ''} onChange={handleChange} className={`${inputClasses} [color-scheme:dark]`} />
                          ) : (
                            <input type={field.type === 'NUMBER' ? 'number' : 'text'} name={field.name} value={formData[field.name] || ''} onChange={handleChange} className={inputClasses} placeholder={`Enter ${field.name}...`} />
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Footer */}
              <div className="mt-16 pt-10 border-t border-white/10 flex flex-col sm:flex-row justify-end gap-4 relative z-10">
                <Link to="/clients" className="px-8 py-4 rounded-2xl font-black text-slate-300 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2 active:scale-95">
                  Cancel
                </Link>
                <button type="submit" disabled={saving} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 min-w-[180px] shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50">
                  {saving ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Save size={20} />
                  )}
                  <span>{isEditing ? 'Update Lead' : 'Create Lead'}</span>
                </button>
              </div>
            </form>
          </motion.div>



        </div>
      </div>
    </>
  );
}
