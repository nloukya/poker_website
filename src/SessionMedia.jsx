import React, { useEffect, useState } from "react";
import {
  Film,
  Plus,
  Upload,
  Play,
  X,
  AlertCircle,
  Download,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  listSessionClips,
  getClipBlob,
  validateVideoFile,
  MEDIA_CHANGE_EVENT,
} from "./media";
const fileSize = (n) =>
  n >= 1024 * 1024
    ? `${(n / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;

export function useClipLibrary(sessionId) {
  const [clips, setClips] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      listSessionClips(sessionId)
        .then((result) => {
          if (active) {
            setClips(result);
            setError("");
            setLoading(false);
          }
        })
        .catch((err) => {
          if (active) {
            setError(err.message);
            setLoading(false);
          }
        });
    refresh();
    window.addEventListener(MEDIA_CHANGE_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(MEDIA_CHANGE_EVENT, refresh);
    };
  }, [sessionId]);
  return { clips, error, loading };
}

function ClipPlayer({ clip }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      objectUrl;
    getClipBlob(clip.id)
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [clip.id]);
  return (
    <article className="clip-player">
      <div className="clip-video-wrap">
        {url && (
          <video
            src={url}
            controls
            preload="metadata"
            playsInline
            aria-label={clip.name}
            onError={() =>
              setError(
                "This browser can’t play this video format. Download it below to watch in another player.",
              )
            }
          />
        )}
        {!url && !error && (
          <span className="video-loading">
            <Film size={23} />
            Loading…
          </span>
        )}
        {error && (
          <p className="video-playback-error">
            <AlertCircle size={18} />
            {error}
          </p>
        )}
      </div>
      <div className="clip-caption">
        <div>
          <strong title={clip.name}>{clip.name}</strong>
          <span>{fileSize(clip.size)} · Saved on this browser</span>
        </div>
        {url && (
          <a
            className="clip-download"
            href={url}
            download={clip.name}
            aria-label={`Download ${clip.name}`}
          >
            <Download size={15} />
            <span>Save clip</span>
          </a>
        )}
      </div>
    </article>
  );
}

export function SessionHighlights({ sessionId, onEdit }) {
  const { clips, error, loading } = useClipLibrary(sessionId);
  return (
    <section className="session-highlights">
      <div className="highlights-heading">
        <div>
          <span className="highlight-heading-icon">
            <Film size={16} />
          </span>
          <div>
            <h3>
              Videos <span>{clips.length}</span>
            </h3>
            <p></p>
          </div>
        </div>
        {onEdit && (
          <button className="text-button" onClick={onEdit}>
            <Plus size={13} />
            Add videos
          </button>
        )}
      </div>
      {loading ? (
        <p className="media-loading">Loading…</p>
      ) : error ? (
        <p className="media-warning">
          <AlertCircle size={15} />
          {error}
        </p>
      ) : clips.length ? (
        <div className="clips-grid">
          {clips.map((clip) => (
            <ClipPlayer key={clip.id} clip={clip} />
          ))}
        </div>
      ) : (
        <div className="no-highlights">
          <span>
            <Play size={18} />
          </span>
          <div>
            <strong>No videos</strong>
            <p></p>
          </div>
          {onEdit && (
            <button className="text-button" onClick={onEdit}>
              Upload video <ArrowGlyph />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
function ArrowGlyph() {
  return <span aria-hidden="true">↗</span>;
}

export function ClipEditor({
  sessionId,
  newClips,
  setNewClips,
  removedClipIds,
  setRemovedClipIds,
  disabled,
}) {
  const { clips, error: storageError, loading } = useClipLibrary(sessionId);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const addFiles = (files) => {
    if (disabled) return;
    const additions = [];
    const errors = [];
    for (const file of Array.from(files)) {
      const validation = validateVideoFile(file);
      if (validation) {
        errors.push(`${file.name}: ${validation}`);
        continue;
      }
      if (
        newClips.some(
          (c) => c.file.name === file.name && c.file.size === file.size,
        ) ||
        additions.some(
          (c) => c.file.name === file.name && c.file.size === file.size,
        )
      ) {
        errors.push(`${file.name} is already queued.`);
        continue;
      }
      additions.push({
        id:
          crypto.randomUUID?.() ||
          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
      });
    }
    setNewClips((prev) => [...prev, ...additions]);
    setError(errors.join(" "));
  };
  const activeClips = clips.filter((c) => !removedClipIds.includes(c.id));
  return (
    <section className="clip-editor">
      <div className="highlights-heading">
        <div>
          <span className="highlight-heading-icon">
            <Film size={17} />
          </span>
          <div>
            <h3>Videos</h3>
            <p>Changes are saved with the session.</p>
          </div>
        </div>
        <span className="optional-badge">OPTIONAL</span>
      </div>
      <label
        className={`video-upload-zone ${dragging ? "is-dragging" : ""} ${disabled || storageError ? "is-disabled" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!storageError) addFiles(e.dataTransfer.files);
        }}
      >
        <span>
          <Upload size={21} />
        </span>
        <strong>Upload videos</strong>
        <p>
          Or <span>choose videos</span> from your device.
        </p>
        <small>Up to 100 MB per clip · MP4 or WebM recommended</small>
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg,.mp4,.webm,.mov,.m4v,.ogg,.ogv"
          multiple
          aria-label="Upload session videos"
          className="file-input"
          disabled={disabled || !!storageError}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {(error || storageError) && (
        <p className="form-error" role="alert">
          <AlertCircle size={15} />
          {error || storageError}
        </p>
      )}
      {loading && <p className="media-loading">Loading saved highlights…</p>}
      <div className="clip-edit-list">
        {activeClips.map((clip) => (
          <div className="clip-edit-row" key={clip.id}>
            <span className="clip-file-icon">
              <Film size={16} />
            </span>
            <span>
              <strong>{clip.name}</strong>
              <small>{fileSize(clip.size)} · Saved clip</small>
            </span>
            {confirmRemove === clip.id ? (
              <span className="remove-clip-confirm">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setRemovedClipIds((prev) => [...prev, clip.id]);
                    setConfirmRemove(null);
                  }}
                >
                  Remove
                </button>
                <button type="button" onClick={() => setConfirmRemove(null)}>
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={disabled}
                className="icon-button"
                aria-label={`Remove ${clip.name}`}
                onClick={() => setConfirmRemove(clip.id)}
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
        {newClips.map((clip) => (
          <div className="clip-edit-row new-clip" key={clip.id}>
            <span className="clip-file-icon">
              <Play size={15} />
            </span>
            <span>
              <strong>{clip.file.name}</strong>
              <small>{fileSize(clip.file.size)} · Ready to save</small>
            </span>
            <span className="clip-new-label">NEW</span>
            <button
              type="button"
              disabled={disabled}
              className="icon-button"
              aria-label={`Remove pending ${clip.file.name}`}
              onClick={() =>
                setNewClips((prev) => prev.filter((c) => c.id !== clip.id))
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
      {removedClipIds.length > 0 && (
        <div className="removed-clips-note">
          <span>
            {removedClipIds.length} clip{removedClipIds.length === 1 ? "" : "s"}{" "}
            will be removed when you save.
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setRemovedClipIds([])}
          >
            <RotateCcw size={12} />
            Undo
          </button>
        </div>
      )}
      <p className="video-storage-note">
        Videos stay in this browser and aren’t included in JSON backups.
        Download individual clips from the session to keep a separate copy.
      </p>
    </section>
  );
}
