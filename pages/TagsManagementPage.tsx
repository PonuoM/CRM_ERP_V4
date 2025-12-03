import React, { useMemo, useState } from 'react';
import { Tag, TagType, User } from '@/types';
import Modal from '@/components/Modal';
import { createTag, deleteTag, updateTag } from '@/services/api';

interface TagsManagementPageProps {
  systemTags?: Tag[];
  users?: User[];
  currentUser?: User;
  onTagDeleted?: (tagId: number) => void;
}

const TagsManagementPage: React.FC<TagsManagementPageProps> = ({ systemTags = [], users = [], currentUser, onTagDeleted }) => {
  const [sysList, setSysList] = useState<Tag[]>(systemTags);
  const [keyword, setKeyword] = useState('');
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [manageSystemTag, setManageSystemTag] = useState<Tag | null>(null);
  const [manageUserTag, setManageUserTag] = useState<{ tag: Tag; owner: string; ownerId: number } | null>(null);
  const [newTagName, setNewTagName] = useState('');

  const filteredSystem = useMemo(() => {
    const k = keyword.toLowerCase();
    return sysList
      .filter(t => t.type === TagType.System)
      .filter(t => !k || t.name.toLowerCase().includes(k));
  }, [sysList, keyword]);

  const userTagSummary = useMemo(() => {
    return users
      .map(u => ({
        user: u,
        count: (u.customTags || []).length,
      }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [users]);

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
      // Remove tag from all customers
      if (onTagDeleted) {
        onTagDeleted(Number(tag.id));
      }
    } catch (e) {
      alert('Failed to delete tag');
    }
  };

  const handleDeleteUserTag = async (tag: Tag) => {
    if (!confirm(`Delete tag "${tag.name}" ?`)) return;
    try {
      await deleteTag(Number(tag.id));
      // Remove tag from all customers
      if (onTagDeleted) {
        onTagDeleted(Number(tag.id));
      }
      window.location.reload(); // Refresh to show updated tags
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
                <div className="flex items-center gap-2">
                  {t.color && (
                    <span 
                      className="w-4 h-4 rounded-full border border-gray-300" 
                      style={{ backgroundColor: t.color }}
                    />
                  )}
                  <span>{t.name}</span>
                </div>
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
          <div className="space-y-2 mb-4">
            {userTagSummary.map(({ user, count }) => (
              <div key={user.id} className="px-3 py-2 bg-gray-50 rounded text-sm flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-semibold">{user.username}</span>
                  <span className="text-xs text-gray-500">ใช้ไป {count}/10</span>
                </div>
                <button
                  className="text-blue-600 hover:underline text-sm"
                  onClick={() => setViewUser(user)}
                >
                  ดู Tag
                </button>
              </div>
            ))}
            {userTagSummary.length === 0 && <p className="text-sm text-gray-500">No users</p>}
          </div>
        </div>
      </div>

      {manageSystemTag && (
        <SystemTagModal tag={manageSystemTag} onClose={() => setManageSystemTag(null)} />
      )}
      {manageUserTag && (
        <UserTagModal 
          item={manageUserTag} 
          onClose={() => setManageUserTag(null)} 
          onDelete={handleDeleteUserTag}
          onTagDeleted={onTagDeleted}
        />
      )}
      {viewUser && (
        <UserTagListModal
          user={viewUser}
          onClose={() => setViewUser(null)}
          onManageTag={(tag) => setManageUserTag({ tag, owner: viewUser.username, ownerId: viewUser.id })}
        />
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
  const [color, setColor] = useState(tag.color || '#9333EA');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateTag(tag.id, { name, color });
      onClose();
      window.location.reload(); // Refresh to show updated tags
    } catch (e) {
      alert('Failed to update tag');
      setLoading(false);
    }
  };

  return (
    <Modal title={`Manage Tag: ${tag.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input className="w-full border rounded-md px-3 py-2 text-sm" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Color</label>
          <div className="flex items-center gap-3">
            <input 
              type="color" 
              value={color} 
              onChange={e=>setColor(e.target.value)}
              className="w-16 h-10 border rounded-md cursor-pointer"
            />
            <input 
              type="text" 
              value={color} 
              onChange={e=>setColor(e.target.value)}
              className="flex-1 border rounded-md px-3 py-2 text-sm"
              placeholder="#9333EA"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-2">
          <button className="px-4 py-2 border rounded-md text-sm" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="px-4 py-2 bg-green-600 text-white rounded-md text-sm" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const UserTagModal: React.FC<{ item: { tag: Tag; owner: string; ownerId: number }; onClose: () => void; onDelete?: (tag: Tag) => void; onTagDeleted?: (tagId: number) => void }> = ({ item, onClose, onDelete, onTagDeleted }) => {
  const [name, setName] = useState(item.tag.name);
  const [color, setColor] = useState(item.tag.color || '#9333EA');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateTag(item.tag.id, { name, color });
      onClose();
      window.location.reload(); // Refresh to show updated tags
    } catch (e) {
      alert('Failed to update tag');
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete tag "${item.tag.name}"?`)) return;
    setDeleting(true);
    try {
      if (onDelete) {
        onDelete(item.tag);
      } else {
        await deleteTag(Number(item.tag.id));
        // Remove tag from all customers
        if (onTagDeleted) {
          onTagDeleted(Number(item.tag.id));
        }
        onClose();
        window.location.reload();
      }
    } catch (e) {
      alert('Failed to delete tag');
      setDeleting(false);
    }
  };

  return (
    <Modal title={`Manage User Tag`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input className="w-full border rounded-md px-3 py-2 text-sm" value={name} onChange={e=>setName(e.target.value)} />
          <p className="text-xs text-gray-500 mt-1">Owner: {item.owner}</p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Color</label>
          <div className="flex items-center gap-3">
            <input 
              type="color" 
              value={color} 
              onChange={e=>setColor(e.target.value)}
              className="w-16 h-10 border rounded-md cursor-pointer"
            />
            <input 
              type="text" 
              value={color} 
              onChange={e=>setColor(e.target.value)}
              className="flex-1 border rounded-md px-3 py-2 text-sm"
              placeholder="#9333EA"
            />
          </div>
        </div>
        <div className="flex justify-between">
          <button 
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700" 
            onClick={handleDelete} 
            disabled={deleting || loading}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
          <div className="flex space-x-2">
            <button className="px-4 py-2 border rounded-md text-sm" onClick={onClose} disabled={loading || deleting}>Cancel</button>
            <button className="px-4 py-2 bg-green-600 text-white rounded-md text-sm" onClick={handleSave} disabled={loading || deleting}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const UserTagListModal: React.FC<{ user: User; onClose: () => void; onManageTag: (tag: Tag) => void }> = ({ user, onClose, onManageTag }) => {
  const tags = user.customTags || [];
  return (
    <Modal title={`Tags ของ ${user.username} (${tags.length}/10)`} onClose={onClose}>
      <div className="space-y-2">
        {tags.length === 0 && <p className="text-sm text-gray-500">ยังไม่มี Tag</p>}
        {tags.map((t) => (
          <div key={t.id} className="px-3 py-2 bg-gray-100 rounded text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              {t.color && (
                <span
                  className="w-4 h-4 rounded-full border border-gray-300"
                  style={{ backgroundColor: t.color }}
                />
              )}
              <span>{t.name}</span>
            </div>
            <button className="text-blue-600 hover:underline" onClick={() => onManageTag(t)}>Manage</button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <button className="px-4 py-2 border rounded-md text-sm" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
};


