import ReactMarkdown from 'react-markdown';

export default function ChatBubble({ role, content, isMobile }) {
  const isUser = role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: isMobile ? 8 : 10
      }}
    >
      <div
        style={{
          maxWidth: isMobile ? '92%' : '85%',
          background: isUser ? '#2563eb' : '#ffffff',
          color: isUser ? '#ffffff' : '#1f2937',
          border: `1px solid ${isUser ? '#2563eb' : '#d1d5db'}`,
          borderRadius: 16,
          padding: isMobile ? '10px 12px' : '12px 14px',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
          fontSize: isMobile ? 14 : 15,
          boxShadow: isUser
            ? '0 6px 18px rgba(37,99,235,0.16)'
            : '0 6px 18px rgba(0,0,0,0.06)'
        }}
      >
        <ReactMarkdown
          components={{
            a: ({ node, ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
