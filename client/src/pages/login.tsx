import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Lock,
  Mail,
  LifeBuoy,
  Inbox,
  BookOpen,
  Globe2,
  Plug,
  Timer,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Shield,
  Cloud,
  Users,
  Building2,
  GaugeCircle,
} from "lucide-react";
import { SynozurLogo } from "@/components/icons/synozur-logo";
import { SynozurAppSwitcher } from "@/components/synozur-app-switcher";
import { Aurora } from "@/components/aurora";
import heroImage from "@assets/Firefly_5c02a715-05d7-48e2-91d7-99c03988b690_1777808195121.jpeg";
import secondaryImage from "@assets/AdobeStock_189127184_1771187213585.jpeg";
import constellationLogoWhite from "@assets/palomar-logo-white.svg";

function trackPageView(path: string) {
  try {
    let sid = sessionStorage.getItem("anon_session_id");
    if (!sid) { sid = crypto.randomUUID(); sessionStorage.setItem("anon_session_id", sid); }
    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, sessionId: sid, referrer: document.referrer }),
    }).catch(() => {});
  } catch {}
}

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSSOLoading, setIsSSOLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => { trackPageView("/login"); }, []);

  const { data: ssoStatus } = useQuery({
    queryKey: ["/api/auth/sso/status"],
    retry: false,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId');
    const error = params.get('error');

    if (sessionId) {
      localStorage.setItem('sessionId', sessionId);
      window.location.href = "/";
    } else if (error) {
      let errorTitle = "SSO Login Failed";
      let errorMessage = error.replace(/_/g, ' ');

      if (error === 'redirect_uri_mismatch') {
        errorMessage = 'Redirect URI mismatch. Please check Azure AD configuration.';
      } else if (error === 'invalid_client_credentials') {
        errorMessage = 'Invalid client credentials. Please check your Azure AD secret.';
      } else if (error === 'invalid_authorization_code') {
        errorMessage = 'Invalid or expired authorization code. Please try again.';
      } else if (error === 'invite_only') {
        const tenantName = params.get('tenant_name') || 'your organization';
        errorTitle = "Access Restricted";
        errorMessage = `${tenantName} requires an invitation to join. Please contact your administrator to request access.`;
      } else if (error === 'domain_blocked') {
        errorTitle = "Domain Not Permitted";
        errorMessage = 'Your email domain is not permitted to access this application. Please contact your administrator.';
      } else if (error === 'user_not_found') {
        errorTitle = "Account Not Found";
        errorMessage = 'Your account was not found. Please contact your administrator to be added.';
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [navigate, toast]);

  const loginMutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/user"], data);
      toast({
        title: "Welcome back!",
        description: `Logged in as ${data.name}`,
      });
      navigate("/");
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  const isDevelopment = import.meta.env.MODE === 'development';

  const primaryFeatures = [
    {
      icon: LifeBuoy,
      title: "Agent Console",
      description: "A dense, fast workspace for your team: saved views, queue routing, SLA badges, internal notes, and a related-KB sidebar that surfaces answers as you read each ticket.",
      highlight: true,
      lightColor: "bg-violet-500/10",
      iconColor: "text-violet-400",
    },
    {
      icon: Globe2,
      title: "No-Login Customer Portal",
      description: "Tenant-branded magic-link portal for requesters. Submit, track, reply, and rate tickets without an account. KB browse and inline ticket deflection built in.",
      highlight: false,
      lightColor: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
    },
    {
      icon: Inbox,
      title: "Email That Just Works",
      description: "Microsoft Graph-backed inbound mail with RFC 5322 threading, durable subscriptions, attachment ingestion, and a per-tenant outbound reply pipeline. Bounces and auto-replies are filtered automatically.",
      highlight: false,
      lightColor: "bg-blue-500/10",
      iconColor: "text-blue-400",
    },
    {
      icon: Timer,
      title: "SLA Tracking & Escalation",
      description: "Per-priority response and resolution targets, automatic breach detection every minute, escalation emails to queue contacts and watchers, and optional priority bumping on breach.",
      highlight: false,
      lightColor: "bg-amber-500/10",
      iconColor: "text-amber-400",
    },
    {
      icon: Plug,
      title: "External API for Your Apps",
      description: "Bearer/API-key endpoints let any SYNOZUR application file, read, and update tickets on behalf of its users — with per-app metrics like open count and 7-day breach rate.",
      highlight: false,
      lightColor: "bg-rose-500/10",
      iconColor: "text-rose-400",
    },
    {
      icon: BookOpen,
      title: "Knowledge Base & Deflection",
      description: "Author public or internal articles with view counters and helpful/not-helpful feedback. The new-ticket form proactively suggests the top three matching articles before a ticket is ever created.",
      highlight: false,
      lightColor: "bg-sky-500/10",
      iconColor: "text-sky-400",
    },
  ];

  const quickFeatures = [
    { icon: LifeBuoy, title: "Tickets", description: "Queues, SLAs, watchers, CSAT" },
    { icon: Inbox, title: "Email Channel", description: "Threaded inbound + outbound replies" },
    { icon: Globe2, title: "Customer Portal", description: "No-login magic-link access" },
    { icon: Plug, title: "External API", description: "Other SYNOZUR apps file tickets" },
  ];

  const capabilities = [
    { icon: Building2, title: "Multi-Tenant", description: "Isolated data, branding, and SLAs per organization" },
    { icon: GaugeCircle, title: "Live Analytics", description: "Volume, breach rate, MTTR, and CSAT trends" },
    { icon: Cloud, title: "M365 Native", description: "Graph mailboxes, Planner sync, Azure AD SSO" },
    { icon: Shield, title: "Enterprise Security", description: "API keys, HMAC webhooks, durable rate limiting" },
  ];

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Synozur",
      url: "https://www.synozur.com",
      description: "Synozur is the creator of Palomar, a multi-tenant support platform for modern teams.",
      brand: {
        "@type": "Brand",
        name: "Palomar",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Palomar",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Palomar by Synozur is a multi-tenant support platform with M365 email integration, a no-login customer portal, an external API for filing tickets from other applications, SLA tracking, and a knowledge base.",
      url: "https://constellation.synozur.com/",
      creator: {
        "@type": "Organization",
        name: "Synozur",
        url: "https://www.synozur.com",
      },
    },
  ];

  return (
    <>
      <Helmet>
        <title>Palomar | Synozur Support Platform</title>
        <meta
          name="description"
          content="Palomar by Synozur is a multi-tenant support platform with M365 email integration, a no-login customer portal, SLA tracking, knowledge base, and an external API that lets your other applications file tickets."
        />
        <link rel="canonical" href="https://constellation.synozur.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://constellation.synozur.com/" />
        <meta property="og:title" content="Palomar | Synozur Support Platform" />
        <meta
          property="og:description"
          content="Palomar by Synozur is a multi-tenant support platform with M365 email integration, a no-login customer portal, SLA tracking, knowledge base, and an external API."
        />
        <meta property="og:image" content="https://constellation.synozur.com/og-image.jpg" />
        <meta property="og:site_name" content="Palomar by Synozur" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Palomar | Synozur Support Platform" />
        <meta
          name="twitter:description"
          content="Palomar by Synozur is a multi-tenant support platform with M365 email integration, a no-login customer portal, SLA tracking, knowledge base, and an external API."
        />
        <meta name="twitter:image" content="https://constellation.synozur.com/og-image.jpg" />
        {structuredData.map((schema, i) => (
          <script key={i} type="application/ld+json">
            {JSON.stringify(schema)}
          </script>
        ))}
      </Helmet>
      <div className="min-h-screen bg-gray-950 text-white">
        {/* Top Navigation Bar */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SynozurAppSwitcher currentApp="constellation" forceDark />
              <SynozurLogo className="h-8 w-8" />
              <div>
                <span className="text-xl font-bold tracking-tight">Palomar</span>
                <span className="text-xs text-gray-500 ml-2">by Synozur</span>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <a href="/portal" className="hidden sm:inline text-sm text-gray-400 hover:text-white transition-colors">
                Customer Portal
              </a>
              <a href="#sign-in" className="text-sm text-gray-400 hover:text-white transition-colors">
                Sign In <ArrowRight className="inline w-3.5 h-3.5 ml-1" />
              </a>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section aria-label="Hero — Sign in to Palomar" className="relative pt-16 overflow-hidden">
          <div className="absolute inset-0 bg-gray-950" />
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
          <Aurora intensity="high" theme="dark" particles className="z-[1]" />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/20 to-gray-950 z-[2]" />
          <div className="relative z-[3] max-w-7xl mx-auto px-6 py-20 lg:py-32">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              {/* Left: Hero Content */}
              <div>
                <img
                  src={constellationLogoWhite}
                  alt="Palomar"
                  className="hidden lg:block h-14 w-auto mb-6"
                />
                <div className="flex items-center gap-2 mb-5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-300/90 text-xs font-semibold tracking-widest uppercase">Multi-Tenant Support System</span>
                </div>
                <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight mb-6">
                  Support That Scales
                  <br />
                  <span className="cosmic-text">
                    Across Every Channel
                  </span>
                </h1>
                <p className="text-base lg:text-lg text-gray-300 max-w-lg mb-8 leading-relaxed">
                  Palomar unifies email, a no-login customer portal, and a
                  first-class API for your other applications — with queues,
                  SLAs, knowledge base, and live analytics in one tenant-aware
                  workspace.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {quickFeatures.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <div key={feature.title} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                        <Icon className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-xs text-white">{feature.title}</p>
                          <p className="text-[11px] text-gray-400 leading-snug">{feature.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500">
                  Need help with an existing ticket?{" "}
                  <a href="/portal" className="text-blue-400 hover:underline font-medium">
                    Visit the customer portal
                  </a>{" "}
                  — no account required.
                </p>
              </div>

              {/* Right: Sign In Card */}
              <div id="sign-in" className="flex justify-center lg:justify-end">
                <Card className="w-full max-w-md bg-gray-900/90 backdrop-blur-xl border-white/10 shadow-2xl shadow-black/40">
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle className="text-2xl text-center text-white">
                      Sign In
                      {isDevelopment && (
                        <span className="block text-sm font-normal text-gray-400 mt-1">
                          Development Environment
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-center text-gray-400">
                      Staff access to the support workspace
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form name="login-form" onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-gray-300">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-500" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500"
                            required
                            data-testid="input-email"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-gray-300">Password</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-500" />
                          <Input
                            id="password"
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="pl-10 bg-gray-800/50 border-white/10 text-white placeholder:text-gray-500 focus:border-blue-500"
                            required
                            data-testid="input-password"
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full text-white font-semibold"
                        style={{ background: 'linear-gradient(to right, #810FFB, #9b3ffe)', }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'linear-gradient(to right, #6f0de0, #810FFB)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(to right, #810FFB, #9b3ffe)')}
                        disabled={loginMutation.isPending}
                        data-testid="button-login"
                      >
                        {loginMutation.isPending ? "Signing in..." : "Sign In"}
                      </Button>
                    </form>

                    {!isDevelopment && (ssoStatus as any)?.configured === true && (
                      <>
                        <div className="relative my-4">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-gray-900 px-2 text-gray-500">Or</span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-white/10"
                          onClick={async () => {
                            setIsSSOLoading(true);
                            try {
                              const response = await apiRequest("/api/auth/sso/login");
                              if (response.authUrl) {
                                window.location.href = response.authUrl;
                              }
                            } catch (error) {
                              toast({
                                title: "SSO Error",
                                description: "Failed to initiate SSO login",
                                variant: "destructive",
                              });
                            } finally {
                              setIsSSOLoading(false);
                            }
                          }}
                          disabled={isSSOLoading}
                          data-testid="button-sso-login"
                        >
                          <SynozurLogo className="mr-2 h-4 w-4" />
                          {isSSOLoading ? "Redirecting..." : "Sign in with Microsoft"}
                        </Button>
                      </>
                    )}

                    {!isDevelopment && (
                      <p className="text-center text-sm text-gray-500 mt-4">
                        {(ssoStatus as any)?.configured === true
                          ? "Use your corporate Microsoft account to sign in"
                          : "For production SSO, configure Azure AD environment variables"
                        }
                      </p>
                    )}

                    <div className="mt-4 pt-4 border-t border-white/10 text-center space-y-2">
                      <p className="text-sm text-gray-500">
                        Don't have an account?{" "}
                        <a href="/signup" className="text-blue-400 hover:underline font-medium">
                          Create your organization
                        </a>
                      </p>
                      <p className="text-xs text-gray-500">
                        A customer with a ticket?{" "}
                        <a href="/portal" className="text-blue-400 hover:underline font-medium">
                          Open the portal
                        </a>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards Section */}
        <section aria-label="Platform features" className="relative py-20 bg-gray-950">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-14">
              <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
                Everything Modern Support Needs
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                One platform for the agents working tickets, the customers raising
                them, and the applications that need to file them programmatically.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {primaryFeatures.map((feature, idx) => {
                const Icon = feature.icon;
                const staggerClass = `stagger-${Math.min(idx + 1, 6)}`;
                return (
                  <div
                    key={feature.title}
                    className={`nebula-card group relative rounded-xl border p-6 transition-all duration-300 hover:-translate-y-1 animate-fade-in-up ${staggerClass} ${
                      feature.highlight
                        ? "border-violet-500/30 bg-gradient-to-br from-violet-950/40 to-purple-950/20 hover:shadow-xl hover:shadow-violet-500/10"
                        : "border-white/10 bg-gray-900/50 hover:bg-gray-900/80 hover:shadow-xl hover:shadow-black/20"
                    }`}
                  >
                    {feature.highlight && (
                      <div className="absolute -top-3 left-6">
                        <span className="bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                          Agent Workspace
                        </span>
                      </div>
                    )}
                    <div className={`w-12 h-12 rounded-xl ${feature.lightColor} flex items-center justify-center mb-4`}>
                      <Icon className={`w-6 h-6 ${feature.iconColor}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Three-Door Spotlight: Agents · Customers · Apps */}
        <section aria-label="Three ways into Palomar" className="relative py-20 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-10"
            style={{ backgroundImage: `url(${secondaryImage})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/95 to-gray-950/90" />
          <div className="relative z-10 max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-violet-400" />
                <span className="text-violet-400 text-xs font-semibold tracking-widest uppercase">
                  Three doors, one platform
                </span>
              </div>
              <h2 className="text-3xl font-bold text-white">
                For agents, customers, and applications
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Agents */}
              <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
                  <Users className="w-5 h-5 text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">For your agents</h3>
                <ul className="space-y-2.5">
                  {[
                    "Saved views: My open, Unassigned, Breaching in 1h",
                    "Inline status, priority, queue, assignee edits",
                    "Public replies and internal notes side by side",
                    "Postgres full-text search across tickets and replies",
                    "Watchers, activity timeline, and related KB suggestions",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                      <ChevronRight className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Customers */}
              <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4">
                  <Globe2 className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">For your customers</h3>
                <ul className="space-y-2.5">
                  {[
                    "No-login portal with magic-link access",
                    "Tenant logo, color, and from-name on every email",
                    "Knowledge base browse with article feedback",
                    "Inline article suggestions before they file a ticket",
                    "CSAT rating after resolution",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                      <ChevronRight className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Apps */}
              <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4">
                  <Plug className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">For your other apps</h3>
                <ul className="space-y-2.5">
                  {[
                    "API keys minted as syn_<prefix>.<secret>",
                    "File, fetch, and update tickets via REST",
                    "HMAC-signed inbound email webhook",
                    "Per-app metrics: open count, breach rate, awaiting customer",
                    "Durable per-key rate limiting",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                      <ChevronRight className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Capabilities */}
        <section aria-label="Enterprise platform capabilities" className="py-20 bg-gray-950/80">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-white mb-3">
                Enterprise-Ready by Default
              </h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Tenant isolation, Microsoft 365 integration, and operational
                visibility — without the integration project.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {capabilities.map((cap) => {
                const Icon = cap.icon;
                return (
                  <div
                    key={cap.title}
                    className="text-center p-6 rounded-xl bg-gray-900/50 border border-white/10 hover:border-blue-500/30 transition-colors"
                  >
                    <div className="w-12 h-12 mx-auto rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="font-semibold text-white mb-2">{cap.title}</h3>
                    <p className="text-sm text-gray-400">{cap.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Strip */}
        <section aria-label="Customer portal call-to-action" className="py-12 bg-gradient-to-r from-violet-950/40 via-gray-950 to-blue-950/40 border-y border-white/5">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <LifeBuoy className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Already have a ticket?</h3>
                <p className="text-sm text-gray-400">Track status, reply, and rate resolution from the customer portal — no login needed.</p>
              </div>
            </div>
            <a
              href="/portal"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/25 transition-colors text-sm font-medium"
            >
              Open the portal
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer aria-label="Site footer" className="border-t border-white/5 py-8">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SynozurLogo className="h-6 w-6" />
              <span className="text-sm text-gray-500">Palomar by Synozur</span>
            </div>
            <nav className="flex items-center gap-4 text-xs text-gray-500">
              <a href="https://www.synozur.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">About Synozur</a>
              <span className="text-gray-700">|</span>
              <a href="https://www.synozur.com/terms" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Terms</a>
              <span className="text-gray-700">|</span>
              <a href="https://www.synozur.com/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Privacy</a>
              <span className="text-gray-700">|</span>
              <a href="https://www.synozur.com/insights" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Blog</a>
              <span className="text-gray-700">|</span>
              <a href="https://www.synozur.com/applications" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Software</a>
              <span className="text-gray-700">|</span>
              <a href="https://www.synozur.com/contact" target="_blank" rel="noopener noreferrer" className="hover:text-gray-300 transition-colors">Contact</a>
            </nav>
            <p className="text-xs text-gray-600">
              &copy; {new Date().getFullYear()} The Synozur Alliance LLC. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
