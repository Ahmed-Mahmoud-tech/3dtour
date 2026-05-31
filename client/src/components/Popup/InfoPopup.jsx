import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

/**
 * InfoPopup
 *
 * Displays a modal overlay with rich content from an InfoSign.
 * htmlContent is sanitized via DOMPurify before injection to prevent XSS.
 *
 * @param {{
 *   content: { title: string, coverImage: string, htmlContent: string },
 *   onClose: function
 * }} props
 */
export default function InfoPopup({ content, onClose }) {
  const overlayRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Click outside to close
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Sanitize HTML content — prevent XSS
  const safeHtml = DOMPurify.sanitize(content?.htmlContent || '', {
    ALLOWED_TAGS: ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'ul', 'ol', 'li',
                   'strong', 'em', 'b', 'i', 'a', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                   'img', 'figure', 'figcaption', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: ['class', 'style', 'href', 'src', 'alt', 'title', 'target'],
    FORCE_BODY: true,
  });

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ pointerEvents: 'all' }}
    >
      <div
        className="relative bg-gray-900 text-white rounded-2xl shadow-2xl max-w-lg w-full mx-4
                   max-h-[80vh] flex flex-col overflow-hidden
                   animate-[fadeInScale_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center
                     rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white
                     text-lg font-bold"
          aria-label="Close"
        >
          ×
        </button>

        {/* Cover image */}
        {content?.coverImage && (
          <div className="w-full h-48 flex-shrink-0 overflow-hidden">
            <img
              src={content.coverImage}
              alt={content?.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {content?.title && (
            <h2 className="text-xl font-bold mb-4 text-white">{content.title}</h2>
          )}

          {safeHtml && (
            <div
              className="prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
