import React, { useState, useRef, useEffect } from 'react';
import {
  Bell, Settings, TrendingUp, Search, Filter, Mic, Square, Loader2, Edit2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, ChevronDown, Play, Share2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, Timestamp, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from './firebase';
import { CustomFieldDef } from './CustomFields';

const DUMMY_LEADS = [
  { id: '1', name: 'Alexander Sterling', email: 'a.sterling@vanguard.io', company: 'Vanguard Systems', location: 'London, UK', source: 'LINKEDIN', score: 85, lastPulse: '2 hours ago', phase: 'QUALIFIED', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', phone: '+44 20 7123 4567' },
  { id: '2', name: 'Elena Thorne', email: 'elena.t@atlas.corp', company: 'Atlas Global', location: 'Berlin, DE', source: 'REFERRAL', score: 62, lastPulse: 'Yesterday', phase: 'NURTURING', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704e', phone: '+49 30 1234 5678' },
  { id: '3', name: 'Julian Rossi', email: 'julian@horizon.com', company: 'Horizon Digital', location: 'Milan, IT', source: 'DIRECT', score: 92, lastPulse: '4 hours ago', phase: 'DISCOVERY', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704f', phone: '+39 02 1234 5678' },
  { id: '4', name: 'Sarah Wick', email: 's.wick@continental.dev', company: 'Continental Dev', location: 'New York, US', source: 'LINKEDIN', score: 15, lastPulse: 'Oct 12, 2023', phase: 'INACTIVE', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704g', phone: '+1 212-555-0199' },
];

export default function Leads({ user }: { user: any }) {
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [leads, setLeads] = useState<any[]>(DUMMY_LEADS);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [shareUrls, setShareUrls] = useState<Record<string, string>>({});
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) {
      setLeads(DUMMY_LEADS);
      setLoadingLeads(false);
      return;
    }
    const qLeads = query(collection(db, 'leads'), where('ownerUid', '==', user.uid));
    const unsubLeads = onSnapshot(qLeads, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as any);
      console.log("Leads fetched from DB:", data);
      data.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setLeads(data.length > 0 ? data : DUMMY_LEADS);
      setLoadingLeads(false);
    }, (error) => {
      console.error("Leads Listener Error:", error);
      setLoadingLeads(false);
    });

    const qRecs = query(collection(db, 'recordings'), where('authorUid', '==', user.uid));
    const unsubRecs = onSnapshot(qRecs, (snapshot) => {
      const allRecs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as any);
      // Filter client-side
      const filteredRecs = allRecs.filter(d => d.authorUid === user.uid || !d.authorUid);
      console.log("Recordings fetched total:", allRecs.length, "Filtered:", filteredRecs.length, "User UID:", user?.uid);
      console.log("All Recordings Details:", allRecs);
      setRecordings(filteredRecs);
    }, (error) => {
      console.error("Leads Recordings Listener Error:", error);
    });

    return () => { unsubLeads(); unsubRecs(); };
  }, [user]);

  // Fetch user's custom field definitions
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'custom_fields'), where('ownerUid', '==', user.uid));
    getDocs(q).then(snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomFieldDef));
      setCustomFieldDefs(data);
    }).catch(console.error);
  }, [user]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);

  const startRecording = async (leadId: string) => {
    try {
      setError('');
      setSuccess('');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser does not support audio recording.");
      }

      const streams: MediaStream[] = [];
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streams.push(micStream);

      let finalStream = micStream;

      if (navigator.mediaDevices.getDisplayMedia) {
        try {
          const systemStream = await navigator.mediaDevices.getDisplayMedia({
            video: { width: 1, height: 1 },
            audio: true
          });

          if (systemStream.getAudioTracks().length > 0) {
            streams.push(systemStream);
            const audioContext = new AudioContext();
            audioContextRef.current = audioContext;
            const dest = audioContext.createMediaStreamDestination();

            const micSource = audioContext.createMediaStreamSource(micStream);
            micSource.connect(dest);

            const systemSource = audioContext.createMediaStreamSource(systemStream);
            systemSource.connect(dest);

            finalStream = dest.stream;
          } else {
            systemStream.getTracks().forEach(t => t.stop());
          }
        } catch (err: any) {
          console.warn("System audio omitted", err);
        }
      }

      streamsRef.current = streams;
      const mediaRecorder = new MediaRecorder(finalStream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        transcribeAndSave(blob, leadId);

        streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };

      mediaRecorder.start();
      setRecordingId(leadId);
    } catch (err: any) {
      console.error("Error starting recording:", err);
      setError(err.message || "Could not start recording.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingId) {
      mediaRecorderRef.current.stop();
      setRecordingId(null);
    }
  };

  const transcribeAndSave = async (audioBlob: Blob, leadId: string) => {
    setIsTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]);
        };
        reader.onerror = () => reject(new Error("Failed to read audio file."));
      });
      const base64Audio = await base64Promise;

      let transcriptText = "No transcript generated.";
      try {
        const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY || ''; // Fallbacks

        if (!apiKey) {
          console.warn("No gemini API key found, skipping transcription from leads.");
        } else {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [
              {
                parts: [
                  { text: "Please transcribe this audio recording of a sales/lead call." },
                  { inlineData: { mimeType: "audio/webm", data: base64Audio } }
                ]
              }
            ]
          });
          transcriptText = response.text || "No transcript generated.";
        }
      } catch (e) {
        console.warn("Transcription failed", e);
      }

      const recordId = uuidv4().slice(0, 8);
      let audioUrl = '';
      
      try {
        const storageRef = ref(storage, `recordings/${recordId}.webm`);
        await uploadBytes(storageRef, audioBlob);
        audioUrl = await getDownloadURL(storageRef);
      } catch (uploadErr) {
        console.warn("Failed to upload audio to Storage. Will save without audio playback.", uploadErr);
      }

      const recordingDoc = {
        id: recordId,
        audioUrl: audioUrl,
        transcript: transcriptText,
        createdAt: Timestamp.now(),
        authorUid: user?.uid || '',
        leadId: leadId
      };

      await setDoc(doc(db, 'recordings', recordId), recordingDoc);
      setSuccess("Call recorded and saved successfully!");
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error(err);
      setError("Failed to save recording.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const createMeeting = async (leadId: string, leadName: string) => {
    setIsCreatingMeeting(true);
    try {
      const id = uuidv4().slice(0, 8);
      const meetingData = {
        id,
        title: `Call with ${leadName}`,
        ownerUid: user.uid,
        createdAt: Timestamp.now()
      };
      await setDoc(doc(db, 'meetings', id), meetingData);
      const url = `${window.location.origin}/m/${id}?l=${leadId}`;
      setShareUrls(prev => ({ ...prev, [leadId]: url }));
    } catch (err) {
      console.error("Error creating link:", err);
      setError("Failed to create shareable link.");
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'QUALIFIED': return 'bg-emerald-100 text-emerald-700';
      case 'NURTURING': return 'bg-orange-100 text-orange-700';
      case 'DISCOVERY': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-600';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-400';
  };

  return (
    <div className="flex-1 text-slate-900 p-8 min-h-[calc(100vh-88px)] bg-transparent">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <div className="text-xs font-extrabold text-indigo-500 tracking-widest uppercase mb-1.5 flex items-center gap-2">
              <TrendingUp size={14} className="animate-pulse" /> 
              Pipeline Management
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Lead Intelligence Ledger</h1>
          </div>
          <div className="flex items-center gap-4">

            <Link to="/clients/new" className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2">
              <span className="text-lg leading-none">+</span> New Lead
            </Link>
          </div>
        </header>

        {(error || success) && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            {error || success}
          </div>
        )}



        {/* Table Section */}
        <div className="bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <div className="p-6 md:px-8 md:py-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/50">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-400" size={18} />
              <input
                type="text"
                placeholder="Search by name, company, or email..."
                className="w-full pl-12 pr-4 py-3 bg-white/50 border border-slate-200/60 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all shadow-sm placeholder:text-slate-400"
              />
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm">
                <Filter size={16} /> Filters
              </button>
              <select className="px-5 py-3 flex-1 md:flex-none bg-white border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-600 outline-none hover:bg-slate-50 transition-all shadow-sm cursor-pointer appearance-none">
                <option>Sort: Latest Activity</option>
                <option>Sort: Score</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  <th className="py-5 px-8">Lead Identity</th>
                  <th className="py-5 px-6">Organization</th>
                  <th className="py-5 px-6">Contact Number</th>
                  <th className="py-5 px-6">Source</th>
                  <th className="py-5 px-6 w-32">Score</th>
                  <th className="py-5 px-6">Last Pulse</th>
                  <th className="py-5 px-6">Phase</th>
                  {customFieldDefs.map(cf => (
                    <th key={cf.id} className="py-5 px-6">{cf.name}</th>
                  ))}
                  <th className="py-5 px-8 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {loadingLeads ? (
                  <tr>
                    <td colSpan={8} className="text-center py-20 px-6">
                      <Loader2 size={32} className="animate-spin text-slate-300 mx-auto" />
                    </td>
                  </tr>
                ) : leads.map((lead, idx) => {
                  const leadRecordings = recordings
                    .filter(rec => rec.meetingId === lead.id || rec.leadId === lead.id)
                    .sort((a, b) => {
                      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                      return timeB - timeA;
                    });

                  return (
                    <React.Fragment key={lead.id}>
                      <tr className={`border-b border-slate-50 hover:bg-blue-50/30 transition-all duration-300 ${expandedLeadId === lead.id ? 'bg-blue-50/50 shadow-inner' : ''}`}>
                        <td className="py-5 px-8">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <img src={lead.avatar} alt="" className="w-12 h-12 rounded-xl object-cover shadow-sm border border-white" />
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white bg-emerald-400" />
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-800 text-[15px]">{lead.name}</div>
                              <div className="text-slate-500 font-medium text-xs mt-0.5 group flex items-center gap-1 cursor-pointer">
                                {lead.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="font-extrabold text-slate-700">{lead.company}</div>
                          <div className="text-slate-400 font-medium text-xs mt-0.5 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"/> {lead.location}</div>
                        </td>
                        <td className="py-5 px-6">
                          <div className="font-bold text-slate-600 bg-slate-100 w-fit px-3 py-1 rounded-lg text-xs">{lead.phone || 'N/A'}</div>
                        </td>
                        <td className="py-5 px-6">
                          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-extrabold px-3 py-1.5 rounded-lg tracking-widest">
                            {lead.source}
                          </span>
                        </td>
                        <td className="py-5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                              <div className={`h-full rounded-full transition-all duration-500 ${getScoreColor(lead.score)}`} style={{ width: `${lead.score}%` }} />
                            </div>
                            <span className={`font-extrabold text-sm ${lead.score >= 50 ? 'text-slate-700' : 'text-slate-400'}`}>{lead.score}</span>
                          </div>
                        </td>
                        <td className="py-5 px-6 text-slate-500 font-medium text-xs">{lead.lastPulse}</td>
                        <td className="py-5 px-6">
                          <span className={`text-[11px] font-extrabold px-4 py-2 rounded-xl tracking-wider shadow-sm border ${getPhaseColor(lead.phase)} border-current/10`}>
                            {lead.phase}
                          </span>
                        </td>
                        {/* Dynamic Custom Field Columns */}
                        {customFieldDefs.map(cf => (
                          <td key={cf.id} className="py-5 px-6">
                            <span className="font-medium text-slate-600 text-xs bg-slate-50 px-2 py-1 rounded-lg">{lead[cf.name] || <span className="text-slate-300">—</span>}</span>
                          </td>
                        ))}
                        <td className="py-5 px-8">
                          <div className="flex items-center justify-end gap-2">
                            <Link to={`/clients/${lead.id}/edit`} className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 w-8 h-8 flex items-center justify-center rounded-xl transition-all">
                              <Edit2 size={16} />
                            </Link>

                            {isTranscribing && recordingId === null ? (
                              <div className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-xl"><Loader2 size={16} className="animate-spin text-blue-500" /></div>
                            ) : recordingId === lead.id ? (
                              <button
                                onClick={stopRecording}
                                className="text-white bg-red-500 hover:bg-red-600 w-8 h-8 flex items-center justify-center rounded-xl transition-all shadow-lg shadow-red-500/30 relative"
                                title="Stop Recording"
                              >
                                <span className="absolute inset-0 bg-red-400 rounded-xl animate-ping opacity-40"></span>
                                <Square size={14} className="fill-current relative z-10" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); startRecording(lead.id); }}
                                className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${recordingId ? 'opacity-30 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-50 hover:text-blue-600'}`}
                                disabled={!!recordingId}
                                title="Record Lead Call"
                              >
                                <Mic size={16} />
                              </button>
                            )}
                            <button
                              className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${expandedLeadId === lead.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                              onClick={(e) => { e.stopPropagation(); setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id); }}
                              title="View Reports & Recordings"
                            >
                              <ChevronDown size={18} className={`transition-transform duration-300 ${expandedLeadId === lead.id ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedLeadId === lead.id && (
                        <tr className="bg-gradient-to-b from-blue-50/50 to-white border-b border-white">
                          <td colSpan={8} className="p-0">
                            <div className="p-8">
                              <div className="flex items-center justify-between mb-6">
                                <h4 className="text-xs font-extrabold text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                  Call History <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md">{leadRecordings.length}</span>
                                </h4>
                                
                                <div className="flex flex-col md:flex-row items-center gap-3 md:w-auto w-full md:pl-6 md:border-l border-slate-200">
                                  {shareUrls[lead.id] ? (
                                    <div className="flex items-center gap-2 w-full md:w-72 bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                                      <input readOnly value={shareUrls[lead.id]} className="flex-1 bg-transparent px-3 py-1.5 text-xs font-mono text-slate-600 outline-none" />
                                      <button onClick={() => { navigator.clipboard.writeText(shareUrls[lead.id]); setSuccess("Link copied!"); setTimeout(() => setSuccess(""), 3000); }} className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors font-bold shadow-sm" title="Copy Guest Link">
                                        <Share2 size={16} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => createMeeting(lead.id, lead.name)}
                                      disabled={isCreatingMeeting}
                                      className="flex justify-center w-full md:w-auto items-center gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-sm shadow-indigo-500/10 disabled:opacity-50"
                                    >
                                      {isCreatingMeeting ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
                                      Generate Guest Link
                                    </button>
                                  )}
                                </div>
                              </div>
                              {leadRecordings.length === 0 ? (
                                <div className="text-sm text-slate-400 font-medium bg-white/50 border border-slate-100 border-dashed rounded-2xl p-8 text-center italic">No recordings have been logged for this lead yet.</div>
                              ) : (
                                <div className="space-y-4">
                                  {leadRecordings.map(rec => (
                                    <div key={rec.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row gap-5 items-center group cursor-pointer" onClick={() => window.location.href = `/r/${rec.id}`}>
                                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                        <Play className="text-blue-600 fill-blue-600 ml-1" size={18} />
                                      </div>
                                      <div className="flex-1">
                                        <div className="text-[11px] text-indigo-500 font-extrabold uppercase tracking-widest mb-1.5">
                                          {rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown Date'}
                                        </div>
                                        <div className="text-sm font-medium text-slate-700 italic line-clamp-2 leading-relaxed">"{rec.transcript}"</div>
                                      </div>
                                      <div className="flex items-center shrink-0">
                                        <div className="bg-slate-50 text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm">
                                          Review Details
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <div>Showing {leads.length} of {leads.length} precision leads</div>
            <div className="flex items-center gap-1">
              <button className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"><ChevronLeft size={16} /></button>
              <button className="px-3 py-1 font-bold bg-[#3b4256] text-white rounded-lg text-xs">1</button>
              <button className="px-3 py-1 font-bold text-slate-600 hover:bg-slate-100 rounded-lg text-xs">2</button>
              <button className="px-3 py-1 font-bold text-slate-600 hover:bg-slate-100 rounded-lg text-xs">3</button>
              <button className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
