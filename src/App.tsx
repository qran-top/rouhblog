/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut, 
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  Timestamp,
  doc,
  setDoc,
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { Reflection, UserProfile, ReflectionEntry } from './types';
import { cn } from './lib/utils';
import { 
  BookOpen, 
  Plus, 
  LogOut, 
  LogIn, 
  Globe, 
  Lock, 
  Trash2, 
  User as UserIcon,
  Search,
  MessageSquare,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Loader2,
  X,
  Mail,
  KeyRound,
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'public' | 'add' | 'auth'>('public');
  const [searchTerm, setSearchTerm] = useState('');

  // Auth state
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  // Form state
  const [verseRef, setVerseRef] = useState('');
  const [entries, setEntries] = useState<ReflectionEntry[]>([{ question: '', answer: '' }]);
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              displayName: u.displayName || displayName || 'مستخدم جديد',
              email: u.email || '',
              role: 'user'
            };
            await setDoc(doc(db, 'users', u.uid), newProfile);
            setProfile(newProfile);
          }
          // Only redirect to dashboard if we are currently in the auth view
          setView(current => current === 'auth' ? 'dashboard' : current);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
        }
      } else {
        setProfile(null);
        // Only redirect to public if we are not in the auth view and not already in public
        setView(current => (current !== 'public' && current !== 'auth') ? 'public' : current);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []); // Empty dependency array to prevent re-subscribing on every keystroke

  useEffect(() => {
    let q;
    let path = 'reflections';
    if (view === 'public') {
      q = query(
        collection(db, 'reflections'),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc')
      );
    } else if (user) {
      q = query(
        collection(db, 'reflections'),
        where('authorId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    } else {
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reflection[];
      setReflections(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return unsubscribe;
  }, [view, user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');
    setSubmitting(true);

    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        setView('dashboard');
      } else if (authMode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const u = userCredential.user;
        const newProfile: UserProfile = {
          uid: u.uid,
          displayName: displayName || 'مستخدم',
          email: email,
          role: 'user'
        };
        await setDoc(doc(db, 'users', u.uid), newProfile);
        setProfile(newProfile);
        setView('dashboard');
      } else if (authMode === 'reset') {
        await sendPasswordResetEmail(auth, email);
        setAuthMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      if (error.code === 'auth/user-not-found') setAuthError('المستخدم غير موجود');
      else if (error.code === 'auth/wrong-password') setAuthError('كلمة المرور خاطئة');
      else if (error.code === 'auth/email-already-in-use') setAuthError('البريد الإلكتروني مستخدم بالفعل');
      else if (error.code === 'auth/weak-password') setAuthError('كلمة المرور ضعيفة جداً');
      else if (error.code === 'auth/operation-not-allowed') setAuthError('تسجيل الدخول بالبريد الإلكتروني غير مفعل في Firebase');
      else setAuthError(`خطأ: ${error.message || 'حدث خطأ ما، يرجى المحاولة مرة أخرى'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('public');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const addEntry = () => {
    setEntries([...entries, { question: '', answer: '' }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length === 1) return;
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateEntry = (index: number, field: keyof ReflectionEntry, value: string) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;
    setEntries(newEntries);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    // Filter out empty entries
    const validEntries = entries.filter(e => e.question.trim() && e.answer.trim());
    if (validEntries.length === 0) {
      alert('يرجى إضافة سؤال وجواب واحد على الأقل');
      return;
    }

    setSubmitting(true);
    const path = 'reflections';
    try {
      await addDoc(collection(db, path), {
        verseRef,
        entries: validEntries,
        authorId: user.uid,
        authorName: profile.displayName,
        createdAt: Timestamp.now(),
        isPublic
      });
      setVerseRef('');
      setEntries([{ question: '', answer: '' }]);
      setView('dashboard');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا التدبر؟')) return;
    const path = `reflections/${id}`;
    try {
      await deleteDoc(doc(db, 'reflections', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const filteredReflections = reflections.filter(r => 
    r.verseRef.includes(searchTerm) || 
    r.authorName.includes(searchTerm) ||
    r.entries?.some(e => e.question.includes(searchTerm) || e.answer.includes(searchTerm)) ||
    r.question?.includes(searchTerm) ||
    r.content?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <BookOpen className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-emerald-900">تَدَبُّر</h1>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button 
                  onClick={() => setView(view === 'dashboard' ? 'public' : 'dashboard')}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
                  title={view === 'dashboard' ? 'عرض العام' : 'لوحة التحكم'}
                >
                  {view === 'dashboard' ? <Globe className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-red-50 text-red-600 rounded-full transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button 
                onClick={() => {
                  setAuthMode('login');
                  setView('auth');
                }}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-full font-medium hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
              >
                <LogIn className="w-4 h-4" />
                <span>دخول</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setView('public')}
            className={cn(
              "px-6 py-2 rounded-full font-medium transition-all whitespace-nowrap",
              view === 'public' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-white text-slate-600 hover:bg-slate-100"
            )}
          >
            التدبرات العامة
          </button>
          {user && (
            <>
              <button 
                onClick={() => setView('dashboard')}
                className={cn(
                  "px-6 py-2 rounded-full font-medium transition-all whitespace-nowrap",
                  view === 'dashboard' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-white text-slate-600 hover:bg-slate-100"
                )}
              >
                تدبراتي
              </button>
              <button 
                onClick={() => setView('add')}
                className={cn(
                  "px-6 py-2 rounded-full font-medium transition-all whitespace-nowrap flex items-center gap-2",
                  view === 'add' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100" : "bg-white text-emerald-600 border border-emerald-100 hover:bg-emerald-50"
                )}
              >
                <Plus className="w-4 h-4" />
                إضافة تدبر
              </button>
            </>
          )}
        </div>

        {/* Search Bar */}
        {(view === 'public' || view === 'dashboard') && (
          <div className="relative mb-8">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="ابحث عن آية، سؤال، أو كاتب..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === 'auth' ? (
            <motion.div 
              key="auth"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto bg-white rounded-3xl p-8 shadow-xl border border-slate-100"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4">
                  {authMode === 'login' ? <LogIn className="w-8 h-8" /> : authMode === 'register' ? <UserPlus className="w-8 h-8" /> : <KeyRound className="w-8 h-8" />}
                </div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {authMode === 'login' ? 'تسجيل الدخول' : authMode === 'register' ? 'إنشاء حساب جديد' : 'استعادة كلمة المرور'}
                </h2>
                <p className="text-slate-500 mt-2">
                  {authMode === 'login' ? 'مرحباً بك مجدداً في تَدَبُّر' : authMode === 'register' ? 'انضم إلينا في رحلة التدبر' : 'أدخل بريدك الإلكتروني لاستعادة الوصول'}
                </p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'register' && (
                  <div className="relative">
                    <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                      required
                      type="text"
                      placeholder="الاسم الكامل"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input 
                    required
                    type="email"
                    placeholder="البريد الإلكتروني"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>
                {authMode !== 'reset' && (
                  <div className="relative">
                    <KeyRound className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                      required
                      type="password"
                      placeholder="كلمة المرور"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-12 pl-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                )}

                {authError && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {authError}
                  </div>
                )}

                {authMessage && (
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-sm flex items-center gap-2">
                    <Globe className="w-4 h-4 shrink-0" />
                    {authMessage}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : authMode === 'login' ? 'دخول' : authMode === 'register' ? 'إنشاء الحساب' : 'إرسال الرابط'}
                </button>
              </form>

              <div className="mt-6 space-y-2 text-center">
                {authMode === 'login' ? (
                  <>
                    <button onClick={() => setAuthMode('register')} className="text-emerald-600 text-sm font-bold hover:underline">ليس لديك حساب؟ سجل الآن</button>
                    <br />
                    <button onClick={() => setAuthMode('reset')} className="text-slate-400 text-xs hover:underline">نسيت كلمة المرور؟</button>
                  </>
                ) : (
                  <button onClick={() => setAuthMode('login')} className="text-emerald-600 text-sm font-bold hover:underline">لديك حساب بالفعل؟ سجل دخولك</button>
                )}
              </div>
            </motion.div>
          ) : view === 'add' ? (
            <motion.div 
              key="add"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/50 border border-slate-100"
            >
              <h2 className="text-2xl font-bold text-emerald-900 mb-6">إضافة تدبر جديد</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">الآية / المرجع</label>
                  <input 
                    required
                    value={verseRef}
                    onChange={(e) => setVerseRef(e.target.value)}
                    placeholder="مثال: سورة البقرة، آية 255"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700">الأسئلة والتدبرات</label>
                    <button 
                      type="button"
                      onClick={addEntry}
                      className="text-emerald-600 text-sm font-bold flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة سؤال آخر
                    </button>
                  </div>

                  {entries.map((entry, index) => (
                    <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                      {entries.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => removeEntry(index)}
                          className="absolute -top-2 -left-2 w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <div className="space-y-4">
                        <div>
                          <input 
                            required
                            value={entry.question}
                            onChange={(e) => updateEntry(index, 'question', e.target.value)}
                            placeholder={`السؤال التدبري ${index + 1}`}
                            className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                        </div>
                        <div>
                          <textarea 
                            required
                            value={entry.answer}
                            onChange={(e) => updateEntry(index, 'answer', e.target.value)}
                            placeholder={`النتيجة / التدبر ${index + 1}`}
                            rows={3}
                            className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl">
                  <input 
                    type="checkbox"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="w-5 h-5 accent-emerald-600"
                  />
                  <label htmlFor="isPublic" className="text-emerald-900 font-medium cursor-pointer flex items-center gap-2">
                    {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    عرض للعلن (متاح للجميع)
                  </label>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'حفظ ونشر'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setView('dashboard')}
                    className="px-8 py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {filteredReflections.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-500 font-medium">لا توجد نتائج حالياً</p>
                  {view === 'dashboard' && (
                    <button 
                      onClick={() => setView('add')}
                      className="mt-4 text-emerald-600 font-bold hover:underline"
                    >
                      ابدأ بإضافة أول تدبر لك
                    </button>
                  )}
                </div>
              ) : (
                filteredReflections.map((r) => (
                  <motion.div 
                    layout
                    key={r.id}
                    className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2 text-emerald-600 font-bold">
                        <BookOpen className="w-4 h-4" />
                        <span>{r.verseRef}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.isPublic ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full font-bold flex items-center gap-1">
                            <Globe className="w-3 h-3" /> عام
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-bold flex items-center gap-1">
                            <Lock className="w-3 h-3" /> خاص
                          </span>
                        )}
                        {view === 'dashboard' && (
                          <button 
                            onClick={() => handleDelete(r.id)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6 mb-6">
                      {r.entries?.map((entry, idx) => (
                        <div key={idx} className="space-y-3">
                          <h3 className="text-lg font-bold text-slate-900 flex items-start gap-2">
                            <MessageSquare className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                            {entry.question}
                          </h3>
                          <div className="bg-slate-50 rounded-2xl p-4 text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {entry.answer}
                          </div>
                        </div>
                      ))}
                      {!r.entries && r.question && (
                        <div className="space-y-3">
                          <h3 className="text-lg font-bold text-slate-900 flex items-start gap-2">
                            <MessageSquare className="w-5 h-5 text-emerald-500 mt-1 shrink-0" />
                            {r.question}
                          </h3>
                          <div className="bg-slate-50 rounded-2xl p-4 text-slate-700 leading-relaxed whitespace-pre-wrap">
                            {r.content}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-50 pt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-slate-500">
                          <UserIcon className="w-3 h-3" />
                        </div>
                        <span className="font-medium">{r.authorName}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{format(r.createdAt.toDate(), 'PPP', { locale: ar })}</span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Floating Action Button */}
      {user && view !== 'add' && (
        <button 
          onClick={() => setView('add')}
          className="fixed bottom-8 left-8 w-14 h-14 bg-emerald-600 text-white rounded-2xl shadow-2xl shadow-emerald-400 flex items-center justify-center hover:scale-110 transition-transform md:hidden z-40"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 mt-12 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm mb-2">برنامج تدبر آيات القرآن الكريم</p>
          <p className="text-emerald-600 font-bold">فريق العلم</p>
        </div>
      </footer>
    </div>
  );
}
