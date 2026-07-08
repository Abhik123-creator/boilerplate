import { Input, PillsInput } from '@boilerplate/ui-common';
import type { DocumentDetail } from '../api';
import { RichTextEditor } from './RichTextEditor';

export function DocumentEditor({ draft, onChange }: {
  draft: DocumentDetail;
  onChange: (draft: DocumentDetail) => void;
}) {
  return (
    <section className="documents-editor" aria-label="Edit document">
      <div className="documents-editor__header">
        <Input
          className="documents-title-input"
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          placeholder="Untitled"
        />
        <div className="documents-editor__row">
          <PillsInput
            label="Labels"
            value={draft.labels}
            onChange={(labels) => onChange({ ...draft, labels })}
            placeholder="Add a label and press Enter"
          />
        </div>
      </div>
      <RichTextEditor
        key={draft.id}
        initialValue={draft.content}
        onChange={(html) => onChange({ ...draft, content: html })}
        placeholder="Start writing..."
      />
    </section>
  );
}
