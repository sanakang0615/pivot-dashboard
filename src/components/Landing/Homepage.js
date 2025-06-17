import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react';
import { BarChart3, TrendingUp, Users, Target, ArrowRight, Sparkles, Zap, Brain } from 'lucide-react';
import '../../styles/fonts.css';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #fafbff 0%, #f8fafc 50%, #f1f5f9 100%)',
      overflow: 'hidden'
    }}>
      {/* Hero Section */}
      <div style={{ 
        padding: '5rem 2rem 8rem', 
        textAlign: 'center',
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative'
      }}>
        {/* Background Blur Effects */}
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '20%',
          width: '300px',
          height: '300px',
          background: 'linear-gradient(135deg, #667eea40, #764ba240)',
          borderRadius: '50%',
          filter: 'blur(100px)',
          zIndex: 0
        }} />
        <div style={{
          position: 'absolute',
          top: '20%',
          right: '10%',
          width: '200px',
          height: '200px',
          background: 'linear-gradient(135deg, #84cc1640, #65a30d40)',
          borderRadius: '50%',
          filter: 'blur(80px)',
          zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '20px',
            fontSize: '0.9rem',
            fontWeight: '500',
            color: '#4b5563',
            marginBottom: '2rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)'
          }}>
            <span className="tossface" style={{ fontSize: '1.2rem' }}>✨</span>
            AI-Powered Marketing Analytics
          </div>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            lineHeight: '1.1',
            marginBottom: '1.5rem',
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Transform Your
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #84cc16 0%, #65a30d 50%, #16a34a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              Marketing Data
            </span>
            <br />
            Into Insights
          </h1>
          
          <p style={{
            fontSize: 'clamp(1.1rem, 2vw, 1.3rem)',
            color: '#64748b',
            maxWidth: '700px',
            margin: '0 auto 3rem',
            lineHeight: '1.6',
            fontWeight: '400'
          }}>
            Upload your campaign data and get AI-powered insights, performance analysis, 
            and actionable recommendations in minutes. No more spreadsheet headaches.
          </p>

          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            justifyContent: 'center', 
            flexWrap: 'wrap',
            marginBottom: '4rem'
          }}>
            <SignedOut>
              <button
                onClick={() => navigate('/analysis')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 2.5rem',
                  background: 'linear-gradient(135deg, #000000 0%, #1c1c1e 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.2s ease',
                  transform: 'translateY(0)',
                  backdropFilter: 'blur(20px)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.15)';
                }}>
                <span className="tossface" style={{ fontSize: '1.3rem' }}>🚀</span>
                Get Started Free
                <ArrowRight size={20} />
              </button>
            </SignedOut>
            
            <SignedIn>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1rem 2.5rem',
                  background: 'linear-gradient(135deg, #000000 0%, #1c1c1e 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                  transition: 'all 0.2s ease',
                  transform: 'translateY(0)',
                  backdropFilter: 'blur(20px)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.15)';
                }}
              >
                <span className="tossface" style={{ fontSize: '1.3rem' }}>📊</span>
                Go to Dashboard
                <ArrowRight size={20} />
              </button>
            </SignedIn>

            <button style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 2rem',
              background: 'rgba(255, 255, 255, 0.8)',
              color: '#374151',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '14px',
              cursor: 'pointer',
              fontSize: '1.1rem',
              fontWeight: '600',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(20px)'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.95)';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.8)';
              e.target.style.transform = 'translateY(0)';
            }}>
              <span className="tossface" style={{ fontSize: '1.2rem' }}>🎬</span>
              Watch Demo
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
          marginTop: '6rem',
          position: 'relative',
          zIndex: 1
        }}>
          <FeatureCard
            emoji="📈"
            icon={<TrendingUp size={28} />}
            title="Performance Analysis"
            description="Get detailed insights into your campaign performance with automated analysis and smart recommendations that actually work."
            gradient="linear-gradient(135deg, #667eea, #764ba2)"
          />
          <FeatureCard
            emoji="💰"
            icon={<Target size={28} />}
            title="Budget Optimization"
            description="Identify top performers and budget wasters. Get specific recommendations for budget reallocation that maximize ROI."
            gradient="linear-gradient(135deg, #f093fb, #f5576c)"
          />
          <FeatureCard
            emoji="👥"
            icon={<Users size={28} />}
            title="Audience Insights"
            description="Understand which creatives and targeting combinations work best for different audience segments and demographics."
            gradient="linear-gradient(135deg, #4facfe, #00f2fe)"
          />
          <FeatureCard
            emoji="🤖"
            icon={<Brain size={28} />}
            title="AI-Powered Recommendations"
            description="Leverage advanced AI to get actionable insights and next steps that are tailored to your specific marketing goals."
            gradient="linear-gradient(135deg, #43e97b, #38f9d7)"
          />
        </div>

        {/* Stats Section */}
        <div style={{
          marginTop: '8rem',
          padding: '3rem',
          background: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2rem',
            textAlign: 'center'
          }}>
            <StatItem emoji="⚡" number="10x" label="Faster Analysis" />
            <StatItem emoji="📊" number="95%" label="Accuracy Rate" />
            <StatItem emoji="💡" number="50+" label="AI Insights" />
            <StatItem emoji="🎯" number="40%" label="ROI Increase" />
          </div>
        </div>
      </div>
    </div>
  );
};

const FeatureCard = ({ emoji, icon, title, description, gradient }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    padding: '2.5rem',
    borderRadius: '20px',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    transform: 'translateY(0)',
    position: 'relative',
    overflow: 'hidden'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'translateY(-8px)';
    e.currentTarget.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.12)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.06)';
  }}>
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '70px',
      height: '70px',
      background: gradient,
      borderRadius: '18px',
      marginBottom: '1.5rem',
      position: 'relative'
    }}>
      <span className="tossface" style={{ 
        fontSize: '2rem',
        position: 'absolute',
        top: '-8px',
        right: '-8px',
        background: 'rgba(255, 255, 255, 0.9)',
        borderRadius: '12px',
        padding: '0.2rem 0.4rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}>
        {emoji}
      </span>
      <div style={{ color: 'white' }}>
        {icon}
      </div>
    </div>
    <h3 style={{
      fontSize: '1.25rem',
      fontWeight: '700',
      color: '#1e293b',
      marginBottom: '1rem',
      letterSpacing: '-0.01em'
    }}>
      {title}
    </h3>
    <p style={{
      color: '#64748b',
      lineHeight: '1.6',
      fontSize: '1rem',
      fontWeight: '400'
    }}>
      {description}
    </p>
  </div>
);

const StatItem = ({ emoji, number, label }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      fontSize: '2rem',
      marginBottom: '0.5rem'
    }}>
      <span className="tossface">{emoji}</span>
    </div>
    <div style={{
      fontSize: '2.5rem',
      fontWeight: '800',
      color: '#1e293b',
      marginBottom: '0.5rem',
      letterSpacing: '-0.02em'
    }}>
      {number}
    </div>
    <div style={{
      fontSize: '1rem',
      color: '#64748b',
      fontWeight: '500'
    }}>
      {label}
    </div>
  </div>
);

export default HomePage;