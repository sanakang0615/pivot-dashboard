import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, MessageCircle, AtSign } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import ContextSelector from './ContextSelector';
import ChatMessage from './ChatMessage';

const ChatSidebar = ({ isOpen, onClose, analysisData }) => {
  const { userId } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedContexts, setSelectedContexts] = useState([]);
  const [showContextSelector, setShowContextSelector] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history when sidebar opens
  useEffect(() => {
    const analysisId = analysisData?._id || analysisData?.analysisId;
    if (isOpen && analysisId && userId) {
      loadChatHistory();
    }
  }, [isOpen, analysisData?._id, analysisData?.analysisId, userId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputValue]);

  const loadChatHistory = async () => {
    try {
      const analysisId = analysisData?._id || analysisData?.analysisId;
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/chat/${analysisId}`, {
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setMessages(result.messages || []);
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const saveChatHistory = async (newMessages) => {
    try {
      const analysisId = analysisData?._id || analysisData?.analysisId;
      await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/chat/${analysisId}`, {
        method: 'POST',
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: newMessages
        })
      });
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputValue.trim(),
      contexts: [...selectedContexts],
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue('');
    setSelectedContexts([]);
    setIsLoading(true);

    try {
      // Send to Gemini API
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/chat/send`, {
        method: 'POST',
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: userMessage.content,
          contexts: userMessage.contexts,
          analysisData: analysisData,
          chatHistory: messages.slice(-10) // Last 10 messages for context
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const aiMessage = {
            id: Date.now() + 1,
            type: 'ai',
            content: result.response,
            timestamp: new Date().toISOString()
          };

          const finalMessages = [...newMessages, aiMessage];
          setMessages(finalMessages);
          saveChatHistory(finalMessages);
        }
      } else {
        throw new Error('Failed to get AI response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      const finalMessages = [...newMessages, errorMessage];
      setMessages(finalMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleContextSelect = (context) => {
    setSelectedContexts(prev => {
      const exists = prev.find(c => c.id === context.id);
      if (exists) {
        return prev.filter(c => c.id !== context.id);
      } else {
        return [...prev, context];
      }
    });
    setShowContextSelector(false);
  };

  const removeContext = (contextId) => {
    setSelectedContexts(prev => prev.filter(c => c.id !== contextId));
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '420px',
      height: '100vh',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(20px)',
      borderLeft: '1px solid rgba(255, 255, 255, 0.3)',
      boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.1)',
      zIndex: 1001,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <MessageCircle size={16} color="white" />
          </div>
          <div>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: '600',
              color: '#1e293b',
              margin: 0
            }}>
              AI Assistant
            </h3>
            <p style={{
              fontSize: '0.8rem',
              color: '#64748b',
              margin: 0
            }}>
              Ask questions about your analysis
            </p>
          </div>
        </div>
        
        <button
          onClick={onClose}
          style={{
            width: '32px',
            height: '32px',
            background: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.95)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.8)';
          }}
        >
          <X size={16} color="#64748b" />
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#64748b'
          }}>
            <MessageCircle size={48} color="#d1d5db" style={{ marginBottom: '1rem' }} />
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' }}>
              Start a conversation
            </h4>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.5' }}>
              Ask questions about your campaign data, get insights, or request specific analysis.
            </p>
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(102, 126, 234, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(102, 126, 234, 0.1)'
            }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
                💡 <strong>Tip:</strong> Use the @ button to include specific data tables in your questions.
              </p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {isLoading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            background: 'rgba(102, 126, 234, 0.05)',
            borderRadius: '12px',
            border: '1px solid rgba(102, 126, 234, 0.1)'
          }}>
            <Loader2 size={16} color="#667eea" className="animate-spin" />
            <span style={{ fontSize: '0.9rem', color: '#475569' }}>
              AI is thinking...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '1rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.3)',
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)'
      }}>
        {/* Selected Contexts */}
        {selectedContexts.length > 0 && (
          <div style={{
            marginBottom: '0.75rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            {selectedContexts.map((context) => (
              <div
                key={context.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(102, 126, 234, 0.1)',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  color: '#475569'
                }}
              >
                <span>{context.name}</span>
                <button
                  onClick={() => removeContext(context.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={12} color="#64748b" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '0.5rem'
        }}>
          <div style={{
            position: 'relative',
            flex: 1
          }}>
            <button
              onClick={() => setShowContextSelector(!showContextSelector)}
              style={{
                position: 'absolute',
                left: '0.75rem',
                bottom: '0.75rem',
                width: '24px',
                height: '24px',
                background: 'rgba(102, 126, 234, 0.1)',
                border: '1px solid rgba(102, 126, 234, 0.2)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                zIndex: 10
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(102, 126, 234, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(102, 126, 234, 0.1)';
              }}
            >
              <AtSign size={12} color="#667eea" />
            </button>

            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your campaign data..."
              disabled={isLoading}
              style={{
                width: '100%',
                minHeight: '44px',
                maxHeight: '120px',
                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                resize: 'none',
                fontSize: '0.9rem',
                lineHeight: '1.4',
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.border = '1px solid rgba(102, 126, 234, 0.4)';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            style={{
              width: '44px',
              height: '44px',
              background: inputValue.trim() && !isLoading 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              opacity: inputValue.trim() && !isLoading ? 1 : 0.5
            }}
          >
            {isLoading ? (
              <Loader2 size={16} color="#667eea" className="animate-spin" />
            ) : (
              <Send size={16} color={inputValue.trim() ? 'white' : '#64748b'} />
            )}
          </button>
        </div>

        {/* Context Selector */}
        {showContextSelector && (
          <ContextSelector
            analysisData={analysisData}
            onSelect={handleContextSelect}
            selectedContexts={selectedContexts}
            onClose={() => setShowContextSelector(false)}
          />
        )}
      </div>
    </div>
  );
};

export default ChatSidebar; 