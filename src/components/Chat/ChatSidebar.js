import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { X, Send, Loader2, MessageCircle, AtSign, Maximize2, Minimize2 } from 'lucide-react';
import { useAuth } from '@clerk/clerk-react';
import ContextSelector from './ContextSelector';
import ChatMessage from './ChatMessage';

const ChatSidebar = ({ isOpen, onClose, analysisData }) => {
  const navigate = useNavigate();
  const { analysisId } = useParams();
  const location = useLocation();
  const { userId } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedContexts, setSelectedContexts] = useState([]);
  const [showContextSelector, setShowContextSelector] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
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

  // Handle clicking outside context selector
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showContextSelector) {
        // Check if click is outside the context selector and @ button
        const contextSelector = document.querySelector('[data-context-selector]');
        const atButton = document.querySelector('[data-at-button]');
        
        if (contextSelector && !contextSelector.contains(event.target) && 
            atButton && !atButton.contains(event.target)) {
          setShowContextSelector(false);
        }
      }
    };

    if (showContextSelector) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContextSelector]);

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
          const loadedMessages = result.messages || [];
          setMessages(loadedMessages);
          
          // Get contexts from the current chat stream
          const chatStreamContexts = [];
          loadedMessages.forEach(message => {
            if (message.contexts && Array.isArray(message.contexts)) {
              message.contexts.forEach(context => {
                if (!chatStreamContexts.some(c => c.id === context.id)) {
                  chatStreamContexts.push(context);
                }
              });
            }
          });
          console.log('📚 Contexts from current chat stream:', chatStreamContexts.map(c => c.name));
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
      // Get all contexts used in the current chat stream
      const chatStreamContexts = [];
      messages.forEach(message => {
        if (message.contexts && Array.isArray(message.contexts)) {
          message.contexts.forEach(context => {
            if (!chatStreamContexts.some(c => c.id === context.id)) {
              chatStreamContexts.push(context);
            }
          });
        }
      });

      // Combine current selection with chat stream contexts
      const allContexts = [...selectedContexts];
      chatStreamContexts.forEach(context => {
        if (!allContexts.some(c => c.id === context.id)) {
          allContexts.push(context);
        }
      });

      // Prepare the request body with all contexts from the conversation
      const requestBody = {
        message: userMessage.content,
        contexts: allContexts, // Send all contexts used in conversation
        analysisData: sanitizeAnalysisData(analysisData),
        chatHistory: messages.slice(-10) // Last 10 messages for context
      };

      // Log the complete prompt being sent to Gemini API
      console.log('🚀 Sending to Gemini API:');
      console.log('📝 User Message:', requestBody.message);
      console.log('🔗 Current Selected Contexts:', userMessage.contexts.map(c => c.name));
      console.log('📚 All Contexts in Conversation:', requestBody.contexts.map(c => c.name));
      console.log('📊 Analysis Data:', requestBody.analysisData);
      console.log('💬 Chat History:', requestBody.chatHistory.length, 'messages');
      console.log('📦 Full Request Body:', JSON.stringify(requestBody, null, 2));

      // Validate request body before sending
      if (!requestBody.message || typeof requestBody.message !== 'string') {
        throw new Error('Invalid message format');
      }

      // Check if request body can be serialized
      try {
        JSON.stringify(requestBody);
      } catch (serializeError) {
        console.error('❌ Request body serialization error:', serializeError);
        throw new Error('Request body contains invalid data that cannot be serialized');
      }

      // Send to Gemini API
      const apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/chat/send`;
      console.log('🌐 Sending request to:', apiUrl);
      console.log('🔧 REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'x-user-id': userId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ API Response:', result);
        
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
        } else {
          throw new Error(result.error || 'API returned success: false');
        }
      } else {
        // Log detailed error information
        const errorText = await response.text();
        console.error('❌ API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.details || errorMessage;
        } catch (e) {
          // If response is not JSON, use the text as is
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'error',
        content: `Sorry, I encountered an error: ${error.message}`,
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
    const isAdding = !selectedContexts.some(c => c.id === context.id);
    
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

  // Sanitize analysisData to prevent serialization issues
  const sanitizeAnalysisData = (data) => {
    if (!data) return null;
    
    try {
      // Create a clean copy with only essential fields
      const sanitized = {
        _id: data._id || data.analysisId,
        fileName: data.fileName,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        metadata: data.metadata ? {
          rowCount: data.metadata.rowCount,
          columnCount: data.metadata.columnCount,
          fileSize: data.metadata.fileSize
        } : null
      };
      
      // Only include these fields if they exist and are not too large
      if (data.pivotData && typeof data.pivotData === 'object') {
        sanitized.pivotData = 'pivot_data_available';
      }
      
      if (data.insights && typeof data.insights === 'string' && data.insights.length < 1000) {
        sanitized.insights = data.insights;
      }
      
      return sanitized;
    } catch (error) {
      console.warn('Failed to sanitize analysisData:', error);
      return {
        _id: data._id || data.analysisId,
        fileName: data.fileName || 'Unknown'
      };
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {isExpanded && (
        <div
          onClick={() => setIsExpanded(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
          }}
        />
      )}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: isExpanded ? '90vw' : '420px',
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
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
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
              {isExpanded ? <Minimize2 size={16} color="#64748b" /> : <Maximize2 size={16} color="#64748b" />}
            </button>
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
        </div>

        {/* Messages */}
        <div 
          className="no-scrollbar"
          style={{
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
                    background: 'rgba(167, 139, 250, 0.15)',
                    border: '1px solid rgba(167, 139, 250, 0.3)',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    color: '#5b21b6',
                    fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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
                    <X size={12} color="#8b5cf6" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '0.5rem'
          }}>
            <button
              onClick={() => setShowContextSelector(!showContextSelector)}
              data-at-button
              style={{
                width: '44px',
                height: '44px',
                background: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                paddingBottom: '1.8rem'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.95)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.8)';
              }}
            >
              <AtSign size={16} color="#64748b" />
            </button>
            
            <div style={{
              position: 'relative',
              flex: 1
            }}>
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
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  resize: 'none',
                  fontSize: '0.9rem',
                  lineHeight: '1.4',
                  fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => {
                  e.target.style.border = '1px solid rgba(167, 139, 250, 0.5)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(167, 139, 250, 0.15)';
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
                <Loader2 size={16} color="#667eea" className="animate-spin" style={{ marginBottom: '1.7rem' }} />
              ) : (
                <Send size={16} color={inputValue.trim() ? 'white' : '#64748b'} style={{ marginBottom: '1.7rem' }} />
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
    </>
  );
};

export default ChatSidebar; 