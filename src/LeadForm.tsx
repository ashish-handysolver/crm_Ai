import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, AlertCircle, Camera, User } from 'lucide-react';
import { doc, getDoc, setDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { CustomFieldDef } from './CustomFields';
import { db } from './firebase';
import { v4 as uuidv4 } from 'uuid';

export default function LeadForm({ user }: { user: any }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [customPhases, setCustomPhases] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<any>({
    name: '',
    email: '',
    company: '',
    location: '',
    phone: '',
    source: 'DIRECT',
    score: 50,
    phase: 'DISCOVERY',
    avatar: ''
  });

  useEffect(() => {
    if (isEditing && id) {
      const fetchLead = async () => {
        try {
          const docRef = doc(db, 'leads', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setFormData({ avatar: '', ...docSnap.data() } as any);
          } else {
             // Mock data population if it's the dummy IDs, so edit works visually
             if (id === '1') setFormData({ name: 'Alexander Sterling', email: 'a.sterling@vanguard.io', company: 'Vanguard Systems', location: 'London, UK', source: 'LINKEDIN', score: 85, phase: 'QUALIFIED', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' });
             else if (id === '2') setFormData({ name: 'Elena Thorne', email: 'elena.t@atlas.corp', company: 'Atlas Global', location: 'Berlin, DE', source: 'REFERRAL', score: 62, phase: 'NURTURING', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704e' });
             else if (id === '3') setFormData({ name: 'Julian Rossi', email: 'julian@horizon.com', company: 'Horizon Digital', location: 'Milan, IT', source: 'DIRECT', score: 92, phase: 'DISCOVERY', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704f' });
             else if (id === '4') setFormData({ name: 'Sarah Wick', email: 's.wick@continental.dev', company: 'Continental Dev', location: 'New York, US', source: 'LINKEDIN', score: 15, phase: 'INACTIVE', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704g' });
             else setError("Lead not found");
          }
        } catch (err) {
          console.error(err);
          setError("Error fetching lead");
        } finally {
          setLoading(false);
        }
      };
      fetchLead();
    }
  }, [id, isEditing]);

  // Fetch custom fields separately so it runs for both new and edit forms
  useEffect(() => {
    if (!user) return;
    // Fetch custom field definitions
    const q = query(collection(db, 'custom_fields'), where('ownerUid', '==', user.uid));
    getDocs(q).then(snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomFieldDef));
      setCustomFieldDefs(data);
    }).catch(console.error);
    // Fetch custom source/phase options from user doc
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        setCustomSources(snap.data().customSources || []);
        setCustomPhases(snap.data().customPhases || []);
      }
    }).catch(console.error);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (!user) {
        throw new Error("You must be logged in to save leads.");
      }

      const leadId = isEditing ? id : uuidv4();
      const payload = {
         ...formData,
         id: leadId,
         updatedAt: Timestamp.now(),
         ...(isEditing ? {} : { createdAt: Timestamp.now(), ownerUid: user.uid })
      };
      
      await setDoc(doc(db, 'leads', leadId as string), payload);
      navigate('/clients');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save lead");
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
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // Compresses the image
          
          setFormData(prev => ({ ...prev, avatar: dataUrl }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center min-h-screen bg-[#f8fafc]"><Loader2 size={32} className="animate-spin text-slate-300" /></div>;
  }

  return (
    <div className="flex-1 bg-[#f8fafc] text-slate-900 p-8 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <Link to="/clients" className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-800 font-medium mb-8 transition-colors">
           <ArrowLeft size={18} /> Back to Leads
        </Link>
        <header className="mb-8">
           <h1 className="text-3xl font-bold tracking-tight">{isEditing ? 'Edit Lead' : 'New Lead'}</h1>
           <p className="text-slate-500 mt-2">Enter the details for {isEditing ? 'this' : 'the new'} lead account below.</p>
        </header>

        {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 text-sm font-medium border border-red-100">
              <AlertCircle size={18} /> {error}
            </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center mb-8">
               <div className="relative group cursor-pointer mb-3">
                 <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                 <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden group-hover:border-slate-400 transition-colors">
                    {formData.avatar ? (
                      <img src={formData.avatar} alt="Avatar profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={32} className="text-slate-300" />
                    )}
                 </div>
                 <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <Camera className="text-white" size={24} />
                 </div>
               </div>
               <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profile Photo</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-8">
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-700">Full Name</label>
                 <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all font-medium" placeholder="E.g. Sarah Wick" />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-700">Email Address</label>
                 <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all font-medium" placeholder="E.g. s.wick@company.com" />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-700">Organization</label>
                 <input required type="text" name="company" value={formData.company} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all font-medium" placeholder="Company Name" />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-700">Location</label>
                 <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all font-medium" placeholder="City, Country" />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-700">Contact Number</label>
                 <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all font-medium" placeholder="E.g. +1 234 567 8900" />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-700">Source</label>
                 <select name="source" value={formData.source} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all font-medium">
                   <option value="LINKEDIN">LinkedIn</option>
                   <option value="REFERRAL">Referral</option>
                   <option value="DIRECT">Direct</option>
                   <option value="WEBSITE">Website</option>
                   {customSources.map(s => <option key={s} value={s}>{s}</option>)}
                 </select>
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-bold text-slate-700">Phase</label>
                 <select name="phase" value={formData.phase} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all font-medium">
                    <option value="DISCOVERY">Discovery</option>
                    <option value="NURTURING">Nurturing</option>
                    <option value="QUALIFIED">Qualified</option>
                    <option value="INACTIVE">Inactive</option>
                    {customPhases.map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
               </div>
               <div className="space-y-2 md:col-span-2">
                 <label className="text-sm font-bold text-slate-700 flex justify-between">
                    Interest Score
                    <span className="text-slate-500 font-medium">{formData.score}/100</span>
                 </label>
                 <input type="range" name="score" min="0" max="100" value={formData.score} onChange={handleChange} className="w-full mt-2 accent-[#3b4256]" />
               </div>

               {/* Dynamic Custom Fields */}
               {customFieldDefs.map(field => (
                 <div key={field.id} className="space-y-2">
                   <label className="text-sm font-bold text-slate-700">{field.name}</label>
                   {field.type === 'DROPDOWN' ? (
                     <select name={field.name} value={formData[field.name] || ''} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all font-medium">
                       <option value="">Select {field.name}</option>
                       {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                     </select>
                   ) : field.type === 'DATE' ? (
                     <input type="date" name={field.name} value={formData[field.name] || ''} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all font-medium" />
                   ) : field.type === 'DATETIME' ? (
                     <input type="datetime-local" name={field.name} value={formData[field.name] || ''} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all font-medium" />
                   ) : (
                     <input type={field.type === 'NUMBER' ? 'number' : 'text'} name={field.name} value={formData[field.name] || ''} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all font-medium" placeholder={`Enter ${field.name}`} />
                   )}
                 </div>
               ))}
            </div>
            
            <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
               <Link to="/clients" className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all">Cancel</Link>
               <button type="submit" disabled={saving} className="flex items-center gap-2 bg-[#3b4256] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#2A303F] transition-all disabled:opacity-50">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {isEditing ? 'Update Lead' : 'Save Lead'}
               </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
