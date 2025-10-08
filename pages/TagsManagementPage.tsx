import React, { useMemo, useState } from 'react';
import { Tag, TagType, User } from '@/types';
import Modal from '@/components/Modal';
import { createTag, deleteTag } from '@/services/api';

interface TagsManagementPageProps {
  systemTags?: Tag[];
  users?: User[];
}

const TagsManagementPage: React.FC<TagsManagementPageProps> = ({ systemTags = [], users = [] }) => {
  const [keyword, setKeyword] = useState('');

  const filteredSystem = useMemo(() => {
    const k = keyword.toLowerCase();
    return systemTags
      .filter(t => t.type === TagType.System)
      .filter(t => !k || t.name.toLowerCase().includes(k));
  }, [systemTags, keyword]);

  const userTags = useMemo(() => {
    const list: { name: string; owner: string }[] = [];
    users.forEach(u => {
      (u.customTags || []).forEach(t => list.push({ name: t.name, owner: u.username }));
    });
    const k = keyword.toLowerCase();
    return list.filter(it => !k || it.name.toLowerCase().includes(k));
  }, [users, keyword]);

  const [manageSystemTag, setManageSystemTag] = useState<Tag | null>(null);
  const [manageUserTag, setManageUserTag] = useState<{ name: string; owner: string } | null>(null);
  const [sysList, setSysList] = useState<Tag[]>(systemTags);
  const [newTagName, setNewTagName] = useState('');

  React.useEffect(() => { setSysList(systemTags); }, [systemTags]);

  const handleAddSystemTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    try {
      const res = await createTag({ name, type: 'SYSTEM' });
      const id = Number((res && (res.id ?? res.ID)) || Date.now());
      setSysList(prev => [...prev, { id, name, type: TagType.System } as Tag]);
      setNewTagName('');
    } catch (e) {
      alert('Failed to create tag');
    }
  };

  const handleDeleteSystemTag = async (tag: Tag) => {
    if (!confirm(`Delete tag "${tag.name}" ?`)) return;
    try {
      await deleteTag(Number(tag.id));
      setSysList(prev => prev.filter(t => t.id !== tag.id));
    } catch (e) {
      alert('Failed to delete tag');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Tags</h2>
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Keyword</label>
            <input value={keyword} onChange={e=>setKeyword(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" placeholder="Search" />
          </div>
          <div className="flex items-end">
            <div className="flex w-full space-x-2">
              <input value={newTagName} onChange={e=>setNewTagName(e.target.value)} className="flex-1 border rounded-md px-3 py-2 text-sm" placeholder="New system tag name" />
              <button className="px-4 py-2 bg-green-600 text-white rounded-md text-sm" onClick={handleAddSystemTag}>Add</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-md font-semibold text-gray-700 mb-4">Standard Tags</h3>
          <div className="space-y-2">
            {filteredSystem.length === 0 && sysList.length === 0 && <p className="text-sm text-gray-500">No tags</p>}
            {(filteredSystem.length > 0 ? filteredSystem : sysList).map(t => (
              <div key={t.id} className="px-3 py-2 bg-gray-100 rounded text-sm flex items-center justify-between">
                <span>{t.name}</span>
                <div className="space-x-3">
                  <button className="text-blue-600 hover:underline" onClick={() => setManageSystemTag(t)}>Manage</button>
                  <button className="text-red-600 hover:underline" onClick={() => handleDeleteSystemTag(t)}>Delete</button>
                </div>
              </div>
            ))}
            
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-md font-semibold text-gray-700 mb-4">User Tags (limit 10/user)</h3>
          <div className="space-y-2">
            {userTags.map((t, i) => (
              <div key={i} className="px-3 py-2 bg-gray-100 rounded text-sm flex items-center justify-between">
                <span>{t.name}</span>
                <div className="space-x-2">
                  <span className="text-xs text-gray-500">by {t.owner}</span>
                  <button className="text-blue-600 hover:underline" onClick={() => setManageUserTag(t)}>Manage</button>
                </div>
              </div>
            ))}
            {userTags.length === 0 && <p className="text-sm text-gray-500">No user tags</p>}
          </div>
        </div>
      </div>

      {manageSystemTag && (
        <SystemTagModal tag={manageSystemTag} onClose={() => setManageSystemTag(null)} />
      )}
      {manageUserTag && (
        <UserTagModal item={manageUserTag} onClose={() => setManageUserTag(null)} />
      )}
    </div>
  );
};

export default TagsManagementPage;

// Mount modals conditionally at bottom of page
// (Inline export adjustment done above)

// Modals
const SystemTagModal: React.FC<{ tag: Tag; onClose: () => void }> = ({ tag, onClose }) => {
  const [name, setName] = useState(tag.name);
  return (
    <Modal title={`Manage Tag: ${tag.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input className="w-full border rounded-md px-3 py-2 text-sm" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div className="flex justify-end space-x-2">
          <button className="px-4 py-2 border rounded-md text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 bg-green-600 text-white rounded-md text-sm" onClick={onClose}>Save</button>
        </div>
      </div>
    </Modal>
  );
};

const UserTagModal: React.FC<{ item: { name: string; owner: string }; onClose: () => void }> = ({ item, onClose }) => {
  const [name, setName] = useState(item.name);
  return (
    <Modal title={`Manage User Tag`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input className="w-full border rounded-md px-3 py-2 text-sm" value={name} onChange={e=>setName(e.target.value)} />
          <p className="text-xs text-gray-500 mt-1">Owner: {item.owner}</p>
        </div>
        <div className="flex justify-end space-x-2">
          <button className="px-4 py-2 border rounded-md text-sm" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 bg-green-600 text-white rounded-md text-sm" onClick={onClose}>Save</button>
        </div>
      </div>
    </Modal>
  );
};


