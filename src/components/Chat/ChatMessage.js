import React from 'react';
import { User, Bot, AlertTriangle, BarChart3, Database, Brain, TrendingUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const ChatMessage = ({ message }) => {
  const isUser = message.type === 'user';
  const isError = message.type === 'error';
  const isAI = message.type === 'ai';

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const getContextIcon = (type) => {
    switch (type) {
      case 'data': return <Database size={12} />;
      case 'pivot': return <BarChart3 size={12} />;
      case 'visualization': return <TrendingUp size={12} />;
      case 'report': return <Brain size={12} />;
      default: return null;
    }
  };

  const getContextColor = (type) => {
    // Return a purple color for all context types
    return '#8b5cf6';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: '0.5rem'
    }}>
      {/* Context Tags (for user messages) */}
      {isUser && message.contexts && message.contexts.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          maxWidth: '85%'
        }}>
          {message.contexts.map((context) => (
            <div
              key={context.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem 0.5rem',
                background: `${getContextColor(context.type)}15`,
                border: `1px solid ${getContextColor(context.type)}40`,
                borderRadius: '6px',
                fontSize: '0.7rem',
                color: getContextColor(context.type),
                fontWeight: '500'
              }}
            >
              {getContextIcon(context.type)}
              {context.name}
            </div>
          ))}
        </div>
      )}

      {/* Message */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        maxWidth: '85%',
        flexDirection: isUser ? 'row-reverse' : 'row'
      }}>
        {/* Avatar */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: isUser 
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            : isError
            ? 'linear-gradient(135deg, #ef4444, #dc2626)'
            : 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          {isUser ? (
            <User size={16} color="white" />
          ) : isError ? (
            <AlertTriangle size={16} color="white" />
          ) : (
            <Bot size={16} color="white" />
          )}
        </div>

        {/* Message Content */}
        <div style={{
          background: isUser 
            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            : isError
            ? 'rgba(239, 68, 68, 0.1)'
            : 'rgba(255, 255, 255, 0.9)',
          color: isUser 
            ? 'white'
            : isError
            ? '#dc2626'
            : '#374151',
          padding: '0.75rem 1rem',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          border: isUser 
            ? 'none'
            : isError
            ? '1px solid rgba(239, 68, 68, 0.2)'
            : '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          backdropFilter: isUser ? 'none' : 'blur(10px)',
          fontSize: '0.9rem',
          lineHeight: '1.5',
          wordBreak: 'break-word'
        }}>
          {isAI ? (
            <ReactMarkdown
              components={{
                h1: ({children}) => <h1 style={{
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  color: '#1e293b',
                  margin: '0.75rem 0 0.5rem 0',
                  borderBottom: '1px solid rgba(102, 126, 234, 0.2)',
                  paddingBottom: '0.25rem'
                }}>{children}</h1>,
                h2: ({children}) => <h2 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  margin: '0.75rem 0 0.5rem 0'
                }}>{children}</h2>,
                h3: ({children}) => <h3 style={{
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  color: '#374151',
                  margin: '0.5rem 0 0.25rem 0'
                }}>{children}</h3>,
                p: ({children}) => <p style={{
                  margin: '0.5rem 0',
                  lineHeight: '1.6'
                }}>{children}</p>,
                ul: ({children}) => <ul style={{
                  margin: '0.5rem 0',
                  paddingLeft: '1.25rem'
                }}>{children}</ul>,
                ol: ({children}) => <ol style={{
                  margin: '0.5rem 0',
                  paddingLeft: '1.25rem'
                }}>{children}</ol>,
                li: ({children}) => <li style={{
                  margin: '0.25rem 0',
                  lineHeight: '1.5'
                }}>{children}</li>,
                strong: ({children}) => <strong style={{
                  fontWeight: '600',
                  color: '#1e293b'
                }}>{children}</strong>,
                em: ({children}) => <em style={{
                  fontStyle: 'italic',
                  color: '#475569'
                }}>{children}</em>,
                code: ({children}) => <code style={{
                  background: 'rgba(102, 126, 234, 0.1)',
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  color: '#667eea'
                }}>{children}</code>,
                blockquote: ({children}) => <blockquote style={{
                  borderLeft: '3px solid rgba(102, 126, 234, 0.3)',
                  paddingLeft: '0.75rem',
                  margin: '0.75rem 0',
                  fontStyle: 'italic',
                  color: '#475569',
                  background: 'rgba(102, 126, 234, 0.05)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0 6px 6px 0'
                }}>{children}</blockquote>
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {message.content}
            </div>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <div style={{
        fontSize: '0.7rem',
        color: '#94a3b8',
        marginLeft: isUser ? 0 : '48px',
        marginRight: isUser ? '48px' : 0
      }}>
        {formatTimestamp(message.timestamp)}
      </div>
    </div>
  );
};

export default ChatMessage; 