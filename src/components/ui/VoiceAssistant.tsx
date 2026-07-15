import { useState } from 'react';
import { Mic, Loader2, Volume2 } from 'lucide-react';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Tu navegador no soporta reconocimiento de voz. Usa Chrome.');
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'es-PE';
    recognition.continuous = true; // ESCUCHA HASTA QUE SE DETENGA MANUALMENTE
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
        const text = finalTranscript.toLowerCase();
        setTranscript(text);
        processCommand(text);
      }
    };

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  const processCommand = (text: string) => {
    if (!text.includes('zigma') && !text.includes('sigma')) return;
    
    setIsProcessing(true);

    // Convertir palabras a números (uno -> 1, cinco -> 5, etc)
    const wordsToNumbers: any = {
      'uno': '1', 'una': '1', 'dos': '2', 'tres': '3', 'cuatro': '4', 
      'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10'
    };
    let processedText = text;
    Object.keys(wordsToNumbers).forEach(word => {
      processedText = processedText.replace(new RegExp(`\\b${word}\\b`, 'g'), wordsToNumbers[word]);
    });
    
    console.log('Texto procesado por Zigma:', processedText);

    // 1. Comando de Búsqueda
    if (processedText.includes('busca') || processedText.includes('buscar')) {
      const query = processedText.split(/busca|buscar/)[1];
      window.dispatchEvent(new CustomEvent('zigma-search', { detail: query?.trim() }));
    }
    
    // 2. Comando Proforma
    if (processedText.includes('proforma') || processedText.includes('cotización')) {
      const items: any[] = [];
      // Regex mejorado: Acepta números, letras, espacios, puntos y 'x' para medidas
      const itemRegex = /(\d+)\s+([a-z0-9\s\.\,x\-\/]+?)(?=\s+\d+\s+|para\s+|con\s+|$)/gi;
      let match;
      
      while ((match = itemRegex.exec(processedText)) !== null) {
        const itemName = match[2].trim().replace(/\s+y\s+$/, '');
        if (itemName.length > 2) {
          items.push({
            quantity: parseInt(match[1]),
            name: itemName
          });
        }
      }

      const clientMatch = processedText.match(/para\s+(?:el\s+cliente\s+)?([a-z\s]+?)(?=\s+con|$)/i);
      const client = clientMatch ? clientMatch[1].trim() : '';
      const includeIgv = processedText.includes('con igv');

      window.dispatchEvent(new CustomEvent('zigma-auto-quote', { 
        detail: { items, client, includeIgv } 
      }));
    }

    setTimeout(() => setIsProcessing(false), 1000);
  };

  return (
    <div className="voice-assistant-container" style={{
      position: 'fixed',
      bottom: '30px',
      right: '30px',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '10px'
    }}>
      {transcript && (
        <div className="glass-panel" style={{
          padding: '10px 20px',
          borderRadius: '20px',
          fontSize: '0.85rem',
          maxWidth: '250px',
          background: 'rgba(0,0,0,0.8)',
          border: '1px solid var(--color-primary)',
          color: 'white',
          animation: 'fadeIn 0.3s'
        }}>
          "{transcript}"
        </div>
      )}
      
      <button 
        onClick={startListening}
        className={`btn-voice ${isListening ? 'active' : ''}`}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          border: 'none',
          background: isListening ? 'var(--color-danger)' : 'var(--color-primary)',
          color: 'white',
          cursor: 'pointer',
          boxShadow: isListening ? '0 0 20px var(--color-danger)' : '0 10px 20px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s'
        }}
      >
        {isProcessing ? <Loader2 className="animate-spin" /> : isListening ? <Volume2 /> : <Mic />}
      </button>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .btn-voice.active { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}
