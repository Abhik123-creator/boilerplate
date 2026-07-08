import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock3, Edit3, FileText, MessageSquare, Plus, Save, X } from 'lucide-react';
import { Button, useToast } from '@boilerplate/ui-common';
import {
  addDocumentComment,
  createPage,
  createSpace,
  getPage,
  listPages,
  listSpaces,
  restoreRevision,
  updatePage,
  type DocSpace,
  type DocumentDetail,
  type DocumentPage,
} from '../api';
import { CreateSpaceModal, type SpaceForm } from '../components/CreateSpaceModal';
import { DocumentEditor } from '../components/DocumentEditor';
import { DocumentInspectorPanel, type InspectorPanel } from '../components/DocumentInspectorPanel';
import { DocumentReader } from '../components/DocumentReader';
import { DocumentsSidebar } from '../components/DocumentsSidebar';
import { markdownToHtml } from '../lib/markdown';
import { pageUrlSegment, resolvePageFromSegment } from '../lib/url';

const EMPTY_SPACE: SpaceForm = { key: '', name: '', description: '' };

export function DocumentsPage() {
  const { showToast } = useToast();
  const { spaceKey, pageSlug } = useParams();
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<DocSpace[]>([]);
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [draft, setDraft] = useState<DocumentDetail | null>(null);
  const [search, setSearch] = useState('');
  const [label, setLabel] = useState('');
  const [spaceForm, setSpaceForm] = useState<SpaceForm>(EMPTY_SPACE);
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activePanel, setActivePanel] = useState<InspectorPanel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [comment, setComment] = useState('');

  // Derived state from URL parameters
  const selectedSpace = spaces.find((s) => s.key === spaceKey || s.id === spaceKey) || spaces[0];
  const selectedSpaceId = selectedSpace?.id || '';

  const selectedPage = resolvePageFromSegment(pages, pageSlug) || pages[0];
  const selectedPageId = selectedPage?.id || '';

  const loadPages = useCallback(async () => {
    if (!selectedSpaceId) {
      setPages([]);
      return;
    }
    const result = await listPages({
      spaceId: selectedSpaceId,
      search: search.trim() || undefined,
      label: label.trim() || undefined,
    });
    setPages(result.rows);
  }, [label, search, selectedSpaceId]);

  // Initial spaces list load
  useEffect(() => {
    let cancelled = false;
    listSpaces().then((result) => {
      if (cancelled) return;
      setSpaces(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Redirect to first space / page if not specified in URL
  useEffect(() => {
    if (spaces.length === 0) return;

    if (!spaceKey) {
      navigate(`/documents/${spaces[0].key}`, { replace: true });
      return;
    }

    if (selectedSpaceId && pages.length > 0 && !pageSlug) {
      const space = spaces.find((s) => s.id === selectedSpaceId);
      if (space && pages[0]) {
        navigate(`/documents/${space.key}/${pageUrlSegment(pages[0])}`, { replace: true });
      }
    }
  }, [spaceKey, pageSlug, spaces, pages, selectedSpaceId, navigate]);

  // Load pages when selected space, search query, or label filters change
  useEffect(() => {
    if (!selectedSpaceId) {
      void Promise.resolve().then(() => setPages([]));
      return;
    }
    let cancelled = false;
    listPages({
      spaceId: selectedSpaceId,
      search: search.trim() || undefined,
      label: label.trim() || undefined,
    }).then((result) => {
      if (cancelled) return;
      setPages(result.rows);
    });
    return () => {
      cancelled = true;
    };
  }, [label, search, selectedSpaceId]);

  // Load page detail when selected page ID changes
  useEffect(() => {
    if (!selectedPageId) {
      void Promise.resolve().then(() => {
        setDetail(null);
        setDraft(null);
        setIsEditing(false);
        setActivePanel(null);
      });
      return;
    }

    getPage(selectedPageId).then(
      (page) => {
        // Automatically convert markdown to HTML and format to rich_text on load
        let content = page.content;
        let format = page.format;
        if (format === 'markdown') {
          content = markdownToHtml(content);
          format = 'rich_text';
        }
        const updatedPage = { ...page, format, content };
        setDetail(updatedPage);
        setDraft(updatedPage);
        setIsEditing(false);
        setActivePanel(null);
      },
      () => {
        setDetail(null);
        setDraft(null);
        setIsEditing(false);
        setActivePanel(null);
      },
    );
  }, [selectedPageId]);

  async function saveSpace() {
    try {
      const space = await createSpace(spaceForm);
      setSpaces((current) => [...current, space]);
      navigate(`/documents/${space.key}`);
      setSpaceForm(EMPTY_SPACE);
      setIsSpaceModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create space', 'error');
    }
  }

  async function createChildPage(parentId?: string | null) {
    if (!selectedSpaceId) {
      showToast('Create a space first', 'error');
      return;
    }
    try {
      const page = await createPage({
        spaceId: selectedSpaceId,
        parentId: parentId ?? null,
        title: 'Untitled page',
        format: 'rich_text',
        content: '',
      });
      setPages((current) => [...current, page]);
      const space = spaces.find((s) => s.id === selectedSpaceId);
      if (space) {
        navigate(`/documents/${space.key}/${pageUrlSegment(page)}`);
      }
      setIsEditing(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create page', 'error');
    }
  }

  async function savePage() {
    if (!draft) return;
    setIsSaving(true);
    try {
      const page = await updatePage(draft.id, {
        title: draft.title,
        format: draft.format,
        content: draft.content,
        labels: draft.labels,
        parentId: draft.parentId,
        spaceId: draft.spaceId,
      });
      setPages((current) => current.map((item) => (item.id === page.id ? page : item)));
      const updated = await getPage(page.id);
      setDetail(updated);
      setDraft(updated);
      setIsEditing(false);
      const space = spaces.find((s) => s.id === selectedSpaceId);
      if (space) {
        navigate(`/documents/${space.key}/${pageUrlSegment(page)}`, { replace: true });
      }
      showToast('Page saved', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save page', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveComment() {
    if (!detail || !comment.trim()) return;
    try {
      await addDocumentComment(detail.id, comment.trim());
      setComment('');
      const updated = await getPage(detail.id);
      setDetail(updated);
      setDraft(updated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add comment', 'error');
    }
  }

  async function restore(pageId: string, revisionId: string) {
    try {
      await restoreRevision(pageId, revisionId);
      const restored = await getPage(pageId);
      setDetail(restored);
      setDraft(restored);
      setIsEditing(false);
      await loadPages();
      showToast('Revision restored', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not restore revision', 'error');
    }
  }

  function selectSpace(spaceId: string) {
    const space = spaces.find((s) => s.id === spaceId);
    if (space) {
      navigate(`/documents/${space.key}`);
    }
  }

  function selectPage(pageId: string) {
    const page = pages.find((p) => p.id === pageId);
    const space = spaces.find((s) => s.id === selectedSpaceId);
    if (page && space) {
      navigate(`/documents/${space.key}/${pageUrlSegment(page)}`);
    }
  }

  function startEditing() {
    if (!detail) return;
    setDraft(detail);
    setIsEditing(true);
    setActivePanel(null);
  }

  function cancelEditing() {
    setDraft(detail);
    setIsEditing(false);
  }

  return (
    <section className="documents-page" aria-label="Documents">
      <DocumentsSidebar
        spaces={spaces}
        selectedSpaceId={selectedSpaceId}
        onSelectSpace={selectSpace}
        onCreateSpace={() => setIsSpaceModalOpen(true)}
        pages={pages}
        selectedPageId={selectedPageId}
        onSelectPage={selectPage}
        onCreatePage={(parentId) => void createChildPage(parentId)}
        search={search}
        onSearchChange={setSearch}
        label={label}
        onLabelChange={setLabel}
      />

      <main className="documents-main">
        <div className="documents-topbar">
          <div>
            <p>
              {selectedSpace?.name ?? 'Documentation'}
              {detail && !isEditing ? ` · Updated ${new Date(detail.updatedAt).toLocaleDateString()}` : ''}
            </p>
            <h1>{detail?.title ?? 'Select or create a page'}</h1>
          </div>
          {detail && (
            <div className="documents-topbar__actions">
              {isEditing ? (
                <>
                  <Button variant="ghost" onClick={cancelEditing} disabled={isSaving}>
                    <X size={16} /> Cancel
                  </Button>
                  <Button variant="primary" onClick={() => void savePage()} disabled={!draft || isSaving}>
                    <Save size={16} />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant={activePanel === 'comments' ? 'secondary' : 'ghost'}
                    onClick={() => setActivePanel((current) => (current === 'comments' ? null : 'comments'))}
                  >
                    <MessageSquare size={16} /> Comments
                  </Button>
                  <Button
                    variant={activePanel === 'history' ? 'secondary' : 'ghost'}
                    onClick={() => setActivePanel((current) => (current === 'history' ? null : 'history'))}
                  >
                    <Clock3 size={16} /> History
                  </Button>
                  <Button variant="primary" onClick={startEditing}>
                    <Edit3 size={16} /> Edit
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {detail ? (
          <div className="documents-workspace">
            {isEditing && draft ? (
              <DocumentEditor draft={draft} onChange={setDraft} />
            ) : (
              <DocumentReader detail={detail} />
            )}

            {activePanel && !isEditing && (
              <DocumentInspectorPanel
                panel={activePanel}
                detail={detail}
                comment={comment}
                onCommentChange={setComment}
                onSaveComment={() => void saveComment()}
                onRestore={(revisionId) => void restore(detail.id, revisionId)}
                onClose={() => setActivePanel(null)}
              />
            )}
          </div>
        ) : (
          <div className="documents-empty">
            <FileText size={32} />
            <h2>No page selected</h2>
            <p>Create a page in {selectedSpace?.name ?? 'a space'} to start documenting.</p>
            <Button variant="primary" onClick={() => void createChildPage()}><Plus size={16} /> New page</Button>
          </div>
        )}
      </main>

      <CreateSpaceModal
        isOpen={isSpaceModalOpen}
        form={spaceForm}
        onChange={setSpaceForm}
        onClose={() => setIsSpaceModalOpen(false)}
        onSave={() => void saveSpace()}
      />
    </section>
  );
}
