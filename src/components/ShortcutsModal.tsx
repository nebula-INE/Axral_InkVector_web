import React from 'react';
import { X, Keyboard, Smartphone } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const toolShortcuts = [
    { key: 'P', desc: 'ペン / ブラシ (スタイラス・筆圧対応)' },
    { key: 'U', desc: '幾何シェイプ (矩形・楕円・直線・星型・三角形、Shiftで比率固定)' },
    { key: 'E', desc: '通常消しゴム (クリックまたはドラッグで線消去)' },
    { key: 'I / Alt', desc: 'スポイト (キャンバスの色を取得)' },
    { key: 'A', desc: '変形・ノード編集 (Scratch風: 輪郭クリックで点追加、角丸/尖り切替)' },
    { key: 'V', desc: '選択・変形 (バウンディングボックス拡大縮小・回転)' },
    { key: 'T', desc: '交差点消しゴム (はみ出し線を交点まで自動削除)' },
    { key: 'C', desc: 'パス切断・ハサミ (クリック位置でパスを分割)' },
    { key: 'W', desc: '線幅編集 (ストローク太さをダイレクト変更)' },
    { key: 'B', desc: 'ベクターバケツ / 塗りつぶし (図形をクリックして彩色・透明化)' },
    { key: 'M', desc: 'カラーメッシュ (格子グラデーション編集)' },
    { key: 'しっぽピン', desc: 'フキダシのしっぽ先端をドラッグして位置調整' },
    { key: 'ダブルクリック', desc: 'フキダシを直接インライン文字編集' },
    { key: 'H / Space', desc: '手のひらツール (キャンバスをドラッグパン)' },
    { key: 'X', desc: '描画色と塗り色の切り替え' },
    { key: 'Delete', desc: '選択したパス/ノードを削除' },
  ];

  const actionShortcuts = [
    { key: 'Ctrl + Z', desc: '元に戻す (Undo 200ステップ)' },
    { key: 'Ctrl + Y', desc: 'やり直す (Redo)' },
    { key: '左右反転', desc: 'キャンバス左右反転表示 (デッサン狂いチェック)' },
    { key: 'Ctrl + 0', desc: 'キャンバス全体表示にフィット' },
    { key: 'Ctrl + 1', desc: '等倍表示 (100%)' },
    { key: 'Ctrl + Shift + 0', desc: 'キャンバス回転リセット' },
    { key: 'Shift + ドラッグ', desc: '縦横比を保って変形 / 正円正方形' },
    { key: 'スクロール', desc: 'カーソル中心でズームイン/アウト' },
    { key: 'Alt + ドラッグ', desc: '即座にパン操作' },
  ];

  const gestureShortcuts = [
    { gesture: '2本指タップ', desc: '元に戻す (Undo)' },
    { gesture: '3本指タップ', desc: 'やり直す (Redo)' },
    { gesture: '2本指ピンチ / 回転', desc: 'キャンバスの滑らかなズーム & 回転' },
    { gesture: 'スタイラス筆圧', desc: '筆圧に応じた線幅と透明度のダイナミクス' },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
            <Keyboard className="w-4 h-4 text-indigo-400" />
            <span>キーボードショートカット & タッチ操作</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-zinc-300">
          {/* Tools */}
          <div>
            <h4 className="text-zinc-400 font-medium mb-2 uppercase tracking-wider text-[11px]">
              ツール切り替え
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {toolShortcuts.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between bg-zinc-800/40 px-2.5 py-1.5 rounded border border-zinc-800/80">
                  <span className="text-zinc-300">{s.desc}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-indigo-400 font-mono font-medium text-[11px]">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Canvas & Editing Actions */}
          <div>
            <h4 className="text-zinc-400 font-medium mb-2 uppercase tracking-wider text-[11px]">
              編集 & キャンバス操作
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {actionShortcuts.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between bg-zinc-800/40 px-2.5 py-1.5 rounded border border-zinc-800/80">
                  <span className="text-zinc-300">{s.desc}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-indigo-400 font-mono font-medium text-[11px]">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Touch & Stylus Gestures */}
          <div>
            <h4 className="text-zinc-400 font-medium mb-2 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
              スタイラス & タッチジェスチャー
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {gestureShortcuts.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between bg-indigo-950/20 px-2.5 py-1.5 rounded border border-indigo-900/30">
                  <span className="text-zinc-300">{s.desc}</span>
                  <span className="text-indigo-400 font-medium">{s.gesture}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 flex justify-end bg-zinc-900/60">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
