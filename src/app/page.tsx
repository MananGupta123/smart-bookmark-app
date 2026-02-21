"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

type Bookmark = {
  id: string;
  title: string;
  url: string;
  created_at: string;
};

function normalizeUrl(input: string) {
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  try {
    const parsed = new URL(withProtocol);
    const hostname = parsed.hostname.toLowerCase();
    const isIpv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(
      hostname,
    );
    const isLocalhost = hostname === "localhost";
    const hasValidDomainPattern =
      /^[a-z0-9.-]+$/.test(hostname) &&
      !hostname.startsWith(".") &&
      !hostname.endsWith(".") &&
      !hostname.includes("..");

    const isHttpProtocol = parsed.protocol === "http:" || parsed.protocol === "https:";
    const isValidHost = isLocalhost || isIpv4 || (hasValidDomainPattern && hostname.includes("."));

    if (!isHttpProtocol || !isValidHost) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export default function Home() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [addingBookmark, setAddingBookmark] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user?.id;

  const loadBookmarks = useCallback(
    async (userId: string) => {
      if (!supabase) {
        return;
      }

      setLoadingBookmarks(true);
      const { data, error: queryError } = await supabase
        .from("bookmarks")
        .select("id, title, url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (queryError) {
        setError(queryError.message);
        setLoadingBookmarks(false);
        return;
      }

      setBookmarks(data ?? []);
      setLoadingBookmarks(false);
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let cancelled = false;

    const setInitialSession = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!cancelled) {
        setSession(currentSession);
      }
    };

    void setInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setError(null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    if (!userId) {
      return;
    }

      const channel = supabase
        .channel(`bookmarks-user-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bookmarks",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void loadBookmarks(userId);
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void loadBookmarks(userId);
          }
        });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadBookmarks, supabase, userId]);

  const signInWithGoogle = async () => {
    if (!supabase) {
      setError(
        "Missing Supabase config. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    setError(null);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (signInError) {
      setError(signInError.message);
    }
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }

    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
      return;
    }

    setBookmarks([]);
  };

  const addBookmark = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!supabase) {
      setError(
        "Missing Supabase config. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      );
      return;
    }

    if (!session?.user) {
      setError("You must be logged in to add a bookmark.");
      return;
    }

    const cleanTitle = title.trim();
    const cleanUrl = normalizeUrl(url.trim());

    if (!cleanTitle || !cleanUrl) {
      setError("Please provide a title and a valid URL.");
      return;
    }

    setAddingBookmark(true);
    const { error: insertError } = await supabase.from("bookmarks").insert({
      title: cleanTitle,
      url: cleanUrl,
      user_id: session.user.id,
    });

    setAddingBookmark(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTitle("");
    setUrl("");
  };

  const deleteBookmark = async (id: string) => {
    if (!supabase) {
      return;
    }

    setError(null);
    setDeletingId(id);

    const { error: deleteError } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", id);

    setDeletingId(null);

    if (deleteError) {
      setError(deleteError.message);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dce9ff_0%,_#f8fafc_35%,_#f6f7f9_100%)] px-4 py-12 md:px-6">
      <main className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-xl shadow-slate-300/25 backdrop-blur md:p-10">
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Smart Bookmark App
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Private bookmarks with Google login and real-time sync.
            </p>
          </div>
          {session ? (
            <button
              type="button"
              onClick={signOut}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Log out
            </button>
          ) : null}
        </div>

        {!session ? (
          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
            {!supabase ? (
              <p className="mb-4 text-slate-700">
                Add Supabase keys in <code>.env.local</code> to enable login.
              </p>
            ) : (
              <p className="mb-4 text-slate-700">
                Sign in with Google to create and manage your private bookmarks.
              </p>
            )}
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={!supabase}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Continue with Google
            </button>
          </section>
        ) : (
          <>
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Signed in as <span className="font-semibold">{session.user.email}</span>
            </div>

            <form onSubmit={addBookmark} className="mb-8 grid gap-3 md:grid-cols-4">
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Bookmark title"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 md:col-span-1"
                required
              />
              <input
                type="text"
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 md:col-span-2"
                required
              />
              <button
                type="submit"
                disabled={addingBookmark}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300 md:col-span-1"
              >
                {addingBookmark ? "Adding..." : "Add bookmark"}
              </button>
            </form>

            <section>
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Your bookmarks</h2>
              {loadingBookmarks ? (
                <p className="text-sm text-slate-500">Loading bookmarks...</p>
              ) : bookmarks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No bookmarks yet. Add one to get started.
                </p>
              ) : (
                <ul className="space-y-3">
                  {bookmarks.map((bookmark) => (
                    <li
                      key={bookmark.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{bookmark.title}</p>
                        <a
                          href={bookmark.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-sm text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {bookmark.url}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteBookmark(bookmark.id)}
                        disabled={deletingId === bookmark.id}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {deletingId === bookmark.id ? "Deleting..." : "Delete"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {error ? (
          <p className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
      </main>
    </div>
  );
}
