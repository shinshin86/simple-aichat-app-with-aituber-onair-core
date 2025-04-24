import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import {
  AITuberOnAirCore,
  AITuberOnAirCoreEvent,
  AITuberOnAirCoreOptions,
  MODEL_GPT_4_1,
  MODEL_GPT_4_1_MINI,
  MODEL_GPT_4_1_NANO,
  MODEL_GPT_4O,
  MODEL_GPT_4O_MINI,
  MODEL_GPT_4_5_PREVIEW,
  MODEL_O3_MINI,
  MODEL_GEMINI_2_0_FLASH,
  MODEL_GEMINI_2_0_FLASH_LITE,
  MODEL_GEMINI_1_5_FLASH,
  MODEL_GEMINI_2_5_PRO_EXP_03_25,
  MODEL_GEMINI_1_5_PRO,
  MODEL_CLAUDE_3_HAIKU,
  MODEL_CLAUDE_3_5_HAIKU,
  MODEL_CLAUDE_3_5_SONNET,
  MODEL_CLAUDE_3_7_SONNET,
} from '@aituber-onair/core';

type BaseMessage = { id: string; role: 'user' | 'assistant' };
type TextMessage = BaseMessage & { kind: 'text'; content: string };
type ImageMessage = BaseMessage & { kind: 'image'; dataUrl: string };
type Message = TextMessage | ImageMessage;

const DEFAULT_SYSTEM_PROMPT = 'あなたはフレンドリーなAITuberです。';
const DEFAULT_CHAT_PROVIDER = 'openai';
const DEFAULT_MODEL = MODEL_GPT_4_1_NANO;

const DO_NOT_SET_API_KEY_MESSAGE = 'API Keyを入力してください。';
const CORE_SETTINGS_APPLIED_MESSAGE = 'AITuberOnAirCoreの設定を反映しました！';
const DO_NOT_SETTINGS_MESSAGE = 'まずは「設定」を行ってください。';
const CORE_NOT_INITIALIZED_MESSAGE = 'AITuberOnAirCoreが初期化されていません。';

// each chat provider's models
const openaiModels = [
  MODEL_GPT_4_1_NANO,
  MODEL_GPT_4_1_MINI,
  MODEL_GPT_4_1,
  MODEL_O3_MINI,
  MODEL_GPT_4O_MINI,
  MODEL_GPT_4O,
  MODEL_GPT_4_5_PREVIEW,
];
const geminiModels = [
  MODEL_GEMINI_2_0_FLASH_LITE,
  MODEL_GEMINI_2_0_FLASH,
  MODEL_GEMINI_1_5_FLASH,
  MODEL_GEMINI_2_5_PRO_EXP_03_25,
  MODEL_GEMINI_1_5_PRO,
];

const claudeModels = [
  MODEL_CLAUDE_3_HAIKU,
  MODEL_CLAUDE_3_5_HAIKU,
  MODEL_CLAUDE_3_5_SONNET,
  MODEL_CLAUDE_3_7_SONNET,
];

const App: React.FC = () => {
  const idCounter = useRef(0);
  const nextId = () => (++idCounter.current).toString();

  const [showSettings, setShowSettings] = useState(false);

  // initialized flag (true if configured)
  const [isConfigured, setIsConfigured] = useState(false);

  // configuration form states
  const [apiKey, setApiKey] = useState<string>('');
  const [systemPrompt, setSystemPrompt] = useState<string>(
    DEFAULT_SYSTEM_PROMPT,
  );
  const [chatProvider, setChatProvider] = useState<string>(
    DEFAULT_CHAT_PROVIDER,
  );
  const [model, setModel] = useState<string>(DEFAULT_MODEL);

  // chat messages state
  const [messages, setMessages] = useState<Message[]>([]);
  // reference to the latest messages
  const messagesRef = useRef<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [partialTextBuffer, setPartialTextBuffer] = useState('');

  // image attachment state
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  // AITuberOnAirCore instance reference
  const aituberRef = useRef<AITuberOnAirCore | null>(null);

  /**
   * when chat provider changes, reset the model to the first one
   */
  useEffect(() => {
    switch (chatProvider) {
      case 'openai':
        setModel(openaiModels[0]);
        break;
      case 'gemini':
        setModel(geminiModels[0]);
        break;
      case 'claude':
        setModel(claudeModels[0]);
        break;
      default:
        setModel(openaiModels[0]);
        break;
    }
  }, [chatProvider]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /**
   * convert messages to API format
   */
  const convertMessagesToApiFormat = (msgs: Message[]) =>
    msgs.map((msg) =>
      msg.kind === 'text'
        ? { role: msg.role, content: msg.content }
        : { role: msg.role, content: '', image_url: msg.dataUrl },
    );

  /**
   * initialize AITuberOnAirCore
   */
  const initializeAITuber = () => {
    if (!apiKey.trim()) {
      alert(DO_NOT_SET_API_KEY_MESSAGE);
      return;
    }

    // if existing instance exists, remove listeners
    if (aituberRef.current) {
      aituberRef.current.removeAllListeners();
    }

    // create options
    const aituberOptions: AITuberOnAirCoreOptions = {
      chatProvider,
      apiKey: apiKey.trim(),
      model,
      chatOptions: {
        systemPrompt: systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
      },
      debug: true,
    };

    // create new instance
    const newAITuber = new AITuberOnAirCore(aituberOptions);

    // register event listeners
    setupEventListeners(newAITuber);

    // store the instance
    aituberRef.current = newAITuber;

    // if there is existing chat history, set it
    if (messagesRef.current.length > 0) {
      newAITuber.setChatHistory(
        convertMessagesToApiFormat(messagesRef.current),
      );
    }

    // set the configured flag to true
    setIsConfigured(true);

    console.log('AITuberOnAirCore initialized with options:', aituberOptions);
    alert(CORE_SETTINGS_APPLIED_MESSAGE);
  };

  /**
   * register event listeners
   */
  const setupEventListeners = (instance: AITuberOnAirCore) => {
    instance.on(AITuberOnAirCoreEvent.PROCESSING_START, (data: any) => {
      console.log('Processing started:', data);
    });

    instance.on(AITuberOnAirCoreEvent.PROCESSING_END, () => {
      console.log('Processing completed');

      // if processing is completed, get the latest chat history
      if (aituberRef.current) {
        const updatedHistory = aituberRef.current.getChatHistory();
        console.log('Updated chat history:', updatedHistory);
      }
    });

    instance.on(
      AITuberOnAirCoreEvent.ASSISTANT_PARTIAL,
      (partialText: string) => {
        console.log('Assistant partial:', partialText);
        updateAssistantPartial(partialText);
      },
    );

    instance.on(AITuberOnAirCoreEvent.ASSISTANT_RESPONSE, (data: any) => {
      const { message } = data;
      console.log('Assistant response completed:', message.content);
      removeAssistantPartial();

      addMessageToUI({
        id: nextId(),
        role: 'assistant',
        kind: 'text',
        content: message.content,
      });
    });

    instance.on(AITuberOnAirCoreEvent.ERROR, (error: any) => {
      console.error('An error occurred:', error);
      alert(`An error occurred:: ${error}`);
    });
  };

  /**
   * send message
   */
  const handleSendMessage = async () => {
    // if not configured, return
    if (!isConfigured) {
      alert(DO_NOT_SETTINGS_MESSAGE);
      return;
    }
    if (!aituberRef.current) {
      alert(CORE_NOT_INITIALIZED_MESSAGE);
      return;
    }

    // get user input and image data URL
    const userMessage = userInput.trim();
    const attachedImageUrl = imageDataUrl;

    if (!userMessage && !attachedImageUrl) return;

    const drafts: Message[] = [];
    if (attachedImageUrl)
      drafts.push({
        id: nextId(),
        role: 'user',
        kind: 'image',
        dataUrl: attachedImageUrl,
      });
    if (userMessage)
      drafts.push({
        id: nextId(),
        role: 'user',
        kind: 'text',
        content: userMessage,
      });

    setMessages((prev) => {
      const newMessages = [...prev, ...drafts];
      aituberRef.current!.setChatHistory(
        convertMessagesToApiFormat(newMessages),
      );
      return newMessages;
    });

    setUserInput('');
    setPartialTextBuffer('');
    setImageDataUrl(null);

    // if image is attached, call vision API
    // if only text, call normal chat API
    if (attachedImageUrl) {
      // send image to AITuberOnAirCore (Vision API)
      console.log('Calling processVisionChat with image...');
      await aituberRef.current.processVisionChat(attachedImageUrl, userMessage);
    } else {
      // send text to AITuberOnAirCore
      console.log('Calling processChat with text...');
      await aituberRef.current.processChat(userMessage);
    }
  };

  /**
   * clear chat history
   */
  const clearChatHistory = () => {
    if (aituberRef.current) {
      aituberRef.current.setChatHistory([]);
      setMessages([]);
      messagesRef.current = [];
      console.log('Chat history cleared');
    }
  };

  /**
   * add message to UI
   */
  const addMessageToUI = (msg: Message) =>
    setMessages((prev) => [...prev, msg]);

  const updateAssistantPartial = (partialText: string) => {
    setPartialTextBuffer((prev) => prev + partialText);
  };

  const removeAssistantPartial = () => {
    setPartialTextBuffer('');
  };

  /**
   * file input onChange: convert selected image to DataURL and store it in state
   */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageDataUrl(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setImageDataUrl(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  /**
   * apply settings
   */
  const handleApplySettings = () => {
    initializeAITuber();
    setShowSettings(false);
  };

  const handleCancelSettings = () => {
    setShowSettings(false);
  };

  return (
    <>
      <header>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h1>Simple AI Chat</h1>
          <div>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                backgroundColor: '#2e997d',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                marginRight: '8px',
              }}
            >
              API設定
            </button>
            <button
              onClick={clearChatHistory}
              style={{
                backgroundColor: '#e01e5a',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
              }}
            >
              履歴クリア
            </button>
          </div>
        </div>
      </header>

      <div className="container">
        <div id="chat-container" className="section">
          <h2>チャット</h2>
          <div>
            選択中のモデル：{chatProvider} / {model}
          </div>
          {!apiKey && (
            <div style={{ color: '#e01e5a' }}>
              API Keyが設定されていません。
            </div>
          )}

          {/* チャットメッセージの表示 */}
          <div id="messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                {msg.kind === 'text' && <div>{msg.content}</div>}
                {msg.kind === 'image' && (
                  <img
                    src={msg.dataUrl}
                    alt="Attached"
                    style={{
                      maxWidth: '200px',
                      display: 'block',
                      marginTop: '8px',
                    }}
                  />
                )}
              </div>
            ))}
            {/* assistant's partial response */}
            {partialTextBuffer && (
              <div className="message assistant assistant-partial">
                {partialTextBuffer}
              </div>
            )}
          </div>

          <div className="input-area" style={{ marginTop: '1rem' }}>
            <input
              type="text"
              id="user-input"
              placeholder={
                isConfigured ? 'メッセージを入力...' : '設定を完了してください'
              }
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              disabled={!isConfigured}
            />

            {/* 画像添付 */}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={!isConfigured}
              style={{ width: '180px' }}
            />

            {/* 送信ボタン */}
            <button
              id="send-btn"
              onClick={handleSendMessage}
              disabled={!isConfigured}
            >
              送信
            </button>
          </div>
          {imageDataUrl && <img src={imageDataUrl} alt="preview" />}
        </div>
      </div>

      {showSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>設定</h2>
            <label htmlFor="apiKey">API Key:</label>
            <input
              type="password"
              id="apiKey"
              placeholder="..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />

            <label htmlFor="systemPrompt">System Prompt:</label>
            <textarea
              id="systemPrompt"
              placeholder="あなたはフレンドリーなAITuberです..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />

            <label htmlFor="chatProvider">Chat Provider:</label>
            <select
              id="chatProvider"
              value={chatProvider}
              onChange={(e) => setChatProvider(e.target.value)}
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="claude">Claude</option>
            </select>

            <label htmlFor="model">Model:</label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {chatProvider === 'openai' &&
                openaiModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              {chatProvider === 'gemini' &&
                geminiModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              {chatProvider === 'claude' &&
                claudeModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>

            <div style={{ marginTop: '16px', textAlign: 'right' }}>
              <button
                style={{ marginRight: '8px', backgroundColor: '#666' }}
                onClick={handleCancelSettings}
              >
                キャンセル
              </button>
              <button
                onClick={handleApplySettings}
                style={{ backgroundColor: '#2e997d' }}
              >
                設定を反映
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
