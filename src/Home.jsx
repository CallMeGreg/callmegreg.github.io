import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { applets, architecture, articles, mobileApps, profile, repositories } from './landingContent.mjs';
import './Home.css';

function Icon({ name = 'arrow', className = '' }) {
  if (name === 'github') {
    return <img className={`lp-icon lp-github-mark ${className}`} src="/images/github-mark.svg" alt="" width="98" height="96" aria-hidden="true" />;
  }
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    external: <path d="M6 18 18 6M6 6h12v12" />,
    terminal: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m7 9 3 3-3 3m6 0h4" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" /><path d="m8 12 3 3 5-6" /></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" /></>,
    branches: <><circle cx="7" cy="5" r="2" /><circle cx="17" cy="8" r="2" /><circle cx="7" cy="19" r="2" /><path d="M7 7v10m10-7c0 5-10 2-10 7" /></>,
    browser: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18M7 6.5h.01M10 6.5h.01" /></>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M10 5h4m-3 14h2" /></>,
  };
  return (
    <svg className={`lp-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function ExternalLink({ href, children, ...props }) {
  return <a href={href} target="_blank" rel="noreferrer" {...props}>{children}<span className="lp-sr-only"> (opens in a new tab)</span></a>;
}

function useReveals(root) {
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches || !('IntersectionObserver' in window)) return;
    const elements = root.current.querySelectorAll('.lp-reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.removeAttribute('data-reveal');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    elements.forEach((element) => {
      element.setAttribute('data-reveal', 'pending');
      observer.observe(element);
    });
    const showAll = () => {
      if (motion.matches) {
        elements.forEach((element) => element.removeAttribute('data-reveal'));
        observer.disconnect();
      }
    };
    motion.addEventListener('change', showAll);
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', showAll);
      elements.forEach((element) => element.removeAttribute('data-reveal'));
    };
  }, [root]);
}

function Portrait({ className = '' }) {
  return <img className={`lp-portrait ${className}`} src={profile.avatar} alt="Greg Mohler" width="460" height="460" fetchpriority="high" />;
}

function Hero() {
  return (
    <section className="lp-hero" aria-labelledby="hero-heading">
      <div className="lp-avatar lp-enter"><Portrait /></div>
      <h1 id="hero-heading" className="lp-eyebrow lp-enter lp-enter-1">{profile.name} <span>/</span> Solutions architect at GitHub</h1>
    </section>
  );
}

function SectionHeading({ number, label, title, children }) {
  return (
    <div className="lp-section-heading lp-reveal">
      <div><p className="lp-eyebrow"><span className="lp-section-number">{number} /</span> {label}</p><h2>{title}</h2></div>
      {children}
    </div>
  );
}

function Repositories() {
  return (
    <section id="work" className="lp-section" aria-labelledby="repositories-heading">
      <SectionHeading number="01" label="Pinned repositories" title={<span id="repositories-heading">Ideas, shipped.</span>}>
        <ExternalLink className="lp-text-link" href={`${profile.url}?tab=repositories`}>All repositories <Icon name="external" /></ExternalLink>
      </SectionHeading>
      <div className="lp-repo-grid">
        {repositories.map((repository, index) => (
          <ExternalLink key={repository.name} className={`lp-repo-card lp-reveal lp-repo-${index}`} href={repository.url}>
            <div className="lp-card-top"><span className="lp-icon-box"><Icon name={repository.icon} /></span><span>{repository.category}</span><Icon name="external" /></div>
            <div className="lp-repo-art" aria-hidden="true">
              {index === 0 ? <div className="lp-shield-art"><span /><span /><Icon name="shield" /></div> : <div className="lp-language-art"><span>{'>'}_</span><div><i /><i /><i /><i /><i /></div></div>}
            </div>
            <h3>{repository.name}</h3>
            <p>{repository.description}</p>
            <div className="lp-repo-footer"><span><i className={`lp-language-dot lp-language-${repository.language.toLowerCase()}`} />{repository.language}</span><span>View repository <Icon /></span></div>
          </ExternalLink>
        ))}
      </div>
    </section>
  );
}

function ArchitectureArt() {
  return (
    <div className="lp-architecture-art" aria-hidden="true">
      <svg viewBox="0 0 400 220" fill="none">
        <path className="lp-blueprint-guide" d="M0 110h400M200 0v220M20 20l360 180M380 20 20 200" />
        <path className="lp-layer lp-layer-bottom" d="m200 96 130 55-130 55-130-55z" />
        <path className="lp-layer lp-layer-middle" d="m200 58 130 55-130 55-130-55z" />
        <path className="lp-layer lp-layer-top" d="m200 20 130 55-130 55L70 75z" />
        <path className="lp-layer-center" d="m200 52 54 23-54 23-54-23z" />
        <path className="lp-layer-line" d="M200 98v108M70 75v76m260-76v76" />
      </svg>
    </div>
  );
}

function Writing() {
  return (
    <section id="writing" className="lp-section" aria-labelledby="writing-heading">
      <SectionHeading number="02" label="Field notes" title={<span id="writing-heading">Built to be shared.</span>}>
        <span className="lp-section-aside">From the work. For the community.</span>
      </SectionHeading>
      <div className="lp-writing-grid">
        <div className="lp-architecture-card lp-reveal">
          <div className="lp-architecture-intro"><div><p className="lp-eyebrow"><Icon name="github" /> GitHub Well-Architected</p><h3>Better foundations.<br />Bigger possibilities.</h3><p>My contributions to building well, at scale.</p></div><ArchitectureArt /></div>
          <div className="lp-architecture-links">
            {architecture.map((article, index) => (
              <ExternalLink href={article.url} key={article.path}><span className="lp-article-number">0{index + 1}</span><span>{article.title}</span><Icon name="external" /></ExternalLink>
            ))}
          </div>
        </div>
        <div className="lp-blog-column">
          <div className="lp-blog-label lp-reveal"><span className="lp-eyebrow">On the GitHub Blog</span><ExternalLink href={profile.blog} className="lp-text-link">All posts <Icon name="external" /></ExternalLink></div>
          {articles.map((article, index) => (
            <ExternalLink href={article.url} key={article.url} className={`lp-blog-card lp-reveal lp-blog-${index}`} aria-label={article.fullTitle}>
              <div className="lp-blog-art" aria-hidden="true"><Icon name={article.icon} /><span /><span /></div>
              <div className="lp-blog-copy"><span className="lp-eyebrow">{article.category}</span><h3>{article.title}</h3><p>{article.description}</p></div>
              <Icon name="external" />
            </ExternalLink>
          ))}
        </div>
      </div>
    </section>
  );
}

function Playground() {
  return (
    <section id="playground" className="lp-section lp-playground" aria-labelledby="playground-heading">
      <SectionHeading number="03" label="The playground" title={<span id="playground-heading">Not everything is work.</span>}>
        <span className="lp-section-aside">Fun little side quests.</span>
      </SectionHeading>
      <section className="lp-platform-group" aria-labelledby="web-apps-heading">
        <div className="lp-platform-heading lp-reveal">
          <h3 id="web-apps-heading"><Icon name="browser" /> Web apps</h3>
          <span className="lp-platform-count" aria-label={`${applets.length} apps`}>{String(applets.length).padStart(2, '0')}</span>
        </div>
        <div className="lp-applet-grid lp-reveal" id="applet-gallery">
          {applets.map((applet, index) => (
            <Link to={applet.path} key={applet.path} className="lp-applet-card" style={{ '--applet-color': applet.color }}>
              <div className="lp-applet-cover"><img src={applet.image} alt="" loading="lazy" width="320" height="320" /><span className="lp-applet-category">{applet.category}</span><span className="lp-applet-launch"><Icon /></span></div>
              <div className="lp-applet-title"><h4>{applet.name}</h4><span>0{index + 1}</span></div>
              <p>{applet.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <section id="ios-apps" className="lp-platform-group lp-platform-mobile" aria-labelledby="ios-apps-heading">
        <div className="lp-platform-heading lp-reveal">
          <h3 id="ios-apps-heading"><Icon name="phone" /> iOS apps</h3>
          <span className="lp-platform-count" aria-label={`${mobileApps.length} apps`}>{String(mobileApps.length).padStart(2, '0')}</span>
        </div>
        <div className="lp-mobile-grid">
          {mobileApps.map((app) => (
            <ExternalLink key={app.url} className="lp-mobile-card lp-reveal" href={app.url}>
              <img className="lp-mobile-icon" src={app.icon} alt="" loading="lazy" width="72" height="72" />
              <div className="lp-mobile-copy"><h4>{app.name}</h4><span>{app.description}</span></div>
              <Icon name="external" />
            </ExternalLink>
          ))}
        </div>
      </section>
    </section>
  );
}

export default function Home() {
  const root = useRef(null);
  useReveals(root);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Greg Mohler - CallMeGreg';
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="lp" ref={root}>
      <a className="lp-skip-link" href="#main-content">Skip to content</a>
      <div className="lp-ambient" aria-hidden="true" />
      <header className="lp-header lp-container">
        <span className="lp-wordmark">callmegreg<span className="lp-wordmark-dot">.</span></span>
        <nav className="lp-nav" aria-label="Main navigation"><a href="#work">Work</a><a href="#writing">Writing</a><a href="#playground">Playground</a></nav>
        <ExternalLink className="lp-header-github" href={profile.url} aria-label="Greg Mohler on GitHub (opens in a new tab)" title="Greg Mohler on GitHub"><Icon name="github" /></ExternalLink>
      </header>
      <main id="main-content" className="lp-container" tabIndex="-1">
        <Hero />
        <Repositories />
        <Writing />
        <Playground />
        <section className="lp-outro lp-reveal" aria-label="Connect on GitHub"><p className="lp-eyebrow">Keep in touch</p><h2>Good things start<br />with a little <em>curiosity.</em></h2><ExternalLink className="lp-primary" href={profile.url}>Let's connect on GitHub <Icon name="external" /></ExternalLink></section>
      </main>
    </div>
  );
}
