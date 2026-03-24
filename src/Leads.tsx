import React, { useState, useRef, useEffect } from 'react';
import {
  Bell, Settings, TrendingUp, Search, Filter, Mic, Square, Loader2, Edit2, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, ChevronDown, Play, Share2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, Timestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';

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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

      const recordingDoc = {
        id: recordId,
        audioData: base64Audio,
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
    <div className="flex-1 bg-[#f8fafc] text-slate-900 p-8 min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <div className="text-xs font-bold text-slate-500 tracking-widest uppercase mb-1">Management</div>
            <h1 className="text-3xl font-bold tracking-tight">Lead Intelligence Ledger</h1>
          </div>
          <div className="flex items-center gap-4">

            <Link to="/clients/new" className="bg-[#3b4256] hover:bg-[#2A303F] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
              <span>+</span> New Lead
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
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by name, company, or email..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3b4256]/20 transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">
                <Filter size={16} /> Filters
              </button>
              <select className="px-4 py-2 flex-1 md:flex-none border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 outline-none hover:bg-slate-50 bg-white">
                <option>Sort: Latest Activity</option>
                <option>Sort: Score</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  <th className="py-4 px-6 font-bold">Lead Identity</th>
                  <th className="py-4 px-6 font-bold">Organization</th>
                  <th className="py-4 px-6 font-bold">Contact Number</th>
                  <th className="py-4 px-6 font-bold">Source</th>
                  <th className="py-4 px-6 font-bold w-32">Score</th>
                  <th className="py-4 px-6 font-bold">Last Pulse</th>
                  <th className="py-4 px-6 font-bold">Phase</th>
                  <th className="py-4 px-6 font-bold text-right">Actions</th>
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
                      <tr className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${expandedLeadId === lead.id ? 'bg-slate-50/80' : ''}`}>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <img src={lead.avatar} alt="" className="w-10 h-10 rounded-lg object-cover" />
                            <div>
                              <div className="font-bold text-slate-900">{lead.name}</div>
                              <div className="text-slate-500 text-xs mt-0.5">{lead.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-semibold text-slate-700">{lead.company}</div>
                          <div className="text-slate-400 text-xs mt-0.5">{lead.location}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-semibold text-slate-700">{lead.phone || 'N/A'}</div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-md tracking-wider">
                            {lead.source}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${getScoreColor(lead.score)}`} style={{ width: `${lead.score}%` }} />
                            </div>
                            <span className={`font-bold text-xs ${lead.score >= 50 ? 'text-slate-700' : 'text-slate-400'}`}>{lead.score}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-500">{lead.lastPulse}</td>
                        <td className="py-4 px-6">
                          <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full tracking-wider ${getPhaseColor(lead.phase)}`}>
                            {lead.phase}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-end gap-3">
                            <Link to={`/clients/${lead.id}/edit`} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
                              <Edit2 size={16} />
                            </Link>

                            {isTranscribing && recordingId === null ? (
                              <Loader2 size={16} className="animate-spin text-slate-300" />
                            ) : recordingId === lead.id ? (
                              <button
                                onClick={stopRecording}
                                className="text-white bg-red-500 hover:bg-red-600 p-1.5 rounded-lg transition-colors relative"
                                title="Stop Recording"
                              >
                                <span className="absolute inset-1 bg-red-400 rounded-md animate-ping opacity-70"></span>
                                <Square size={16} className="fill-current relative z-10" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); startRecording(lead.id); }}
                                className={`text-slate-400 p-1.5 rounded-lg transition-colors ${recordingId ? 'opacity-30 cursor-not-allowed' : 'hover:text-black hover:bg-slate-100'}`}
                                disabled={!!recordingId}
                                title="Record Lead Call"
                              >
                                <Mic size={16} className={recordingId ? '' : 'text-blue-500 hover:text-blue-600'} />
                              </button>
                            )}
                            <button
                              className={`text-slate-400 p-1.5 hover:bg-slate-200 rounded-lg transition-all ${expandedLeadId === lead.id ? 'bg-slate-200 text-slate-800' : ''}`}
                              onClick={(e) => { e.stopPropagation(); setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id); }}
                              title="View Reports & Recordings"
                            >
                              <ChevronDown size={16} className={`transition-transform duration-200 ${expandedLeadId === lead.id ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedLeadId === lead.id && (
                        <tr className="bg-slate-50/80 border-b border-slate-100">
                          <td colSpan={8} className="p-0">
                            <div className="p-6">
                              <div className="flex items-center justify-between mb-6">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                  Call History ({leadRecordings.length})
                                </h4>
                                
                                <div className="flex items-center gap-2 w-96 pl-4 border-l border-slate-200">
                                  {shareUrls[lead.id] ? (
                                    <>
                                      <input readOnly value={shareUrls[lead.id]} className="flex-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-600" />
                                      <button onClick={() => { navigator.clipboard.writeText(shareUrls[lead.id]); setSuccess("Link copied!"); setTimeout(() => setSuccess(""), 3000); }} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-600" title="Copy Guest Link">
                                        <Share2 size={16} />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => createMeeting(lead.id, lead.name)}
                                      disabled={isCreatingMeeting}
                                      className="flex justify-center w-full items-center gap-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                    >
                                      {isCreatingMeeting ? <Loader2 className="animate-spin" size={14} /> : <Share2 size={14} />}
                                      Create Guest Link
                                    </button>
                                  )}
                                </div>
                              </div>
                              {leadRecordings.length === 0 ? (
                                <div className="text-sm text-slate-500 italic">No recordings have been logged for this lead yet.</div>
                              ) : (
                                <div className="space-y-3">
                                  {leadRecordings.map(rec => (
                                    <div key={rec.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-4">
                                      <div className="flex-1">
                                        <div className="text-xs text-slate-500 mb-2 font-medium">
                                          {rec.createdAt?.toDate ? rec.createdAt.toDate().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown Date'}
                                        </div>
                                        <div className="text-sm text-slate-700 italic line-clamp-2">"{rec.transcript}"</div>
                                      </div>
                                      <div className="flex items-center">
                                        <Link to={`/r/${rec.id}`} className="bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                                          <Play size={14} className="fill-current" /> Play & Read
                                        </Link>
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
