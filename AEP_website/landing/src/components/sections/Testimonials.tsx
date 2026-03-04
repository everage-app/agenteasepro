export function Testimonials() {
  const testimonials = [
    {
      quote: "I used to spend hours chasing deadline dates and sending contracts. Now AgentEasePro handles it all. I've closed 3 more deals this quarter just from the time I've saved.",
      author: "Jessica Martinez",
      role: "Realtor®, Salt Lake City",
      avatar: "JM",
      gradient: "from-[#f4b860] to-amber-400",
      stat: "+3 deals/quarter",
    },
    {
      quote: "The Utah REPC generator alone is worth it. No more filling out PDFs by hand. It even calculates all the deadlines automatically. Game changer.",
      author: "Michael Chen",
      role: "Broker, Park City",
      avatar: "MC",
      gradient: "from-slate-400 to-slate-500",
      stat: "5 hours saved/week",
    },
    {
      quote: "Finally a CRM that actually understands how Utah real estate works. The due diligence reminders have saved me from missing critical dates twice already.",
      author: "Sarah Reynolds",
      role: "Realtor®, Provo",
      avatar: "SR",
      gradient: "from-white to-slate-300",
      stat: "0 missed deadlines",
    },
  ];

  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-slate-950"></div>
      
      {/* Decorative orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-radial from-[#f4b860]/10 to-transparent rounded-full blur-[100px]"></div>
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-gradient-radial from-slate-500/10 to-transparent rounded-full blur-[100px]"></div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-sm font-medium text-[#f4b860] mb-6">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            Loved by Utah Agents
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Real agents. <span className="gradient-text">Real results.</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            See why Utah's top-producing agents are switching to AgentEasePro
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="group relative rounded-2xl p-8 bg-gradient-to-br from-slate-900/90 to-slate-800/50 border border-white/[0.06] backdrop-blur-xl transition-all duration-500 hover:border-white/20 hover:scale-[1.02]"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03) inset'
              }}
            >
              {/* Quote mark */}
              <div className="absolute top-6 right-6 text-6xl text-white/5 font-serif leading-none">"</div>
              
              {/* Stars */}
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-[#f4b860]" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* Quote */}
              <p className="text-slate-300 leading-relaxed mb-8 relative z-10">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${testimonial.gradient} flex items-center justify-center text-sm font-bold text-slate-900`}>
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-white">{testimonial.author}</div>
                  <div className="text-sm text-slate-400">{testimonial.role}</div>
                </div>
              </div>

              {/* Result stat */}
              <div className="mt-6 pt-6 border-t border-white/[0.06]">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${testimonial.gradient}/10 border border-white/10`}>
                  <svg className="w-4 h-4 text-[#f4b860]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <span className="text-sm font-medium text-white">{testimonial.stat}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof banner */}
        <div className="mt-16 flex flex-wrap justify-center items-center gap-8 lg:gap-16">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {['JB', 'MK', 'SR', 'TW', 'LP'].map((initials, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-white ring-2 ring-slate-950">
                  {initials}
                </div>
              ))}
            </div>
            <span className="text-sm text-slate-400">Join 200+ Utah agents</span>
          </div>
          <div className="h-8 w-px bg-slate-700 hidden lg:block"></div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-[#f4b860]">4.9</span>
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-4 h-4 text-[#f4b860]" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-sm text-slate-400">average rating</span>
          </div>
          <div className="h-8 w-px bg-slate-700 hidden lg:block"></div>
          <div className="text-sm text-slate-400">
            <span className="text-white font-semibold">$47M+</span> in managed transactions
          </div>
        </div>
      </div>
    </section>
  );
}
