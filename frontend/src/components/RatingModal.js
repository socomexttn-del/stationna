import React, { useState } from 'react';
import { Star, X, Send, ThumbsUp } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

const RatingModal = ({ ride, onClose, onSubmit, isOpen }) => {
  const [rating, setRating] = useState(5);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const quickComments = [
    { emoji: '👍', text: 'Excellent chauffeur' },
    { emoji: '🚗', text: 'Conduite fluide' },
    { emoji: '⏰', text: 'Ponctuel' },
    { emoji: '💬', text: 'Très agréable' },
    { emoji: '🧹', text: 'Véhicule propre' },
  ];

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        ride_id: ride.id,
        rating,
        comment: comment.trim() || null
      });
      setSubmitted(true);
      toast.success('Merci pour votre évaluation !');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addQuickComment = (text) => {
    setComment(prev => prev ? `${prev} ${text}` : text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card border border-white/10 rounded-2xl w-full max-w-md mx-4 p-6 animate-scale-in shadow-2xl">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          // Success state
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ThumbsUp className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Merci !</h3>
            <p className="text-muted-foreground">Votre avis aide à améliorer le service</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-1" style={{ fontFamily: 'Space Grotesk' }}>
                Évaluez votre course
              </h3>
              <p className="text-muted-foreground text-sm">
                Comment s'est passée votre course avec {ride?.driver_name} ?
              </p>
            </div>

            {/* Stars */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                  data-testid={`rating-star-${star}`}
                >
                  <Star 
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Rating label */}
            <p className="text-center text-sm text-muted-foreground mb-4">
              {rating === 1 && 'Très mauvais'}
              {rating === 2 && 'Mauvais'}
              {rating === 3 && 'Correct'}
              {rating === 4 && 'Bien'}
              {rating === 5 && 'Excellent'}
            </p>

            {/* Quick comments */}
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {quickComments.map((qc, idx) => (
                <button
                  key={idx}
                  onClick={() => addQuickComment(qc.text)}
                  className="px-3 py-1.5 bg-muted/50 hover:bg-muted border border-white/10 rounded-full text-xs transition-colors"
                >
                  {qc.emoji} {qc.text}
                </button>
              ))}
            </div>

            {/* Comment textarea */}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ajoutez un commentaire (optionnel)"
              className="w-full h-24 px-4 py-3 bg-muted/30 border border-white/10 rounded-xl text-sm resize-none focus:border-primary outline-none transition-colors"
              data-testid="rating-comment"
            />

            {/* Submit button */}
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full h-12 mt-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-semibold"
              data-testid="submit-rating"
            >
              {isSubmitting ? (
                <span className="animate-pulse">Envoi...</span>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Envoyer mon évaluation
                </>
              )}
            </Button>

            {/* Skip link */}
            <button 
              onClick={onClose}
              className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Passer cette étape
            </button>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default RatingModal;
