from fastapi.testclient import TestClient
from app import create_app


def test_create_save_share_and_permissions(tmp_path):
    client = TestClient(create_app(str(tmp_path / 'test.db')))
    initial = client.get('/api/documents', params={'user_id':1}).json()
    assert initial == []
    created = client.post('/api/documents', json={'user_id':1,'title':'Research note'})
    assert created.status_code == 201
    document_id = created.json()['id']
    assert client.get(f'/api/documents/{document_id}',params={'user_id':2}).status_code == 404
    saved = client.patch(f'/api/documents/{document_id}', json={
        'user_id':1, 'content':'<h2>Hello</h2><script>alert(1)</script><p>World</p>'})
    assert saved.status_code == 200
    assert client.get(f'/api/documents/{document_id}',params={'user_id':1}).json()['content'].find('<script>') == -1
    assert client.post(f'/api/documents/{document_id}/share', json={'user_id':2,'target_user_id':3}).status_code==404
    assert client.post(f'/api/documents/{document_id}/share', json={'user_id':1,'target_user_id':2}).status_code==201
    assert client.get(f'/api/documents/{document_id}',params={'user_id':2}).status_code==200
    assert client.get(f'/api/documents/{document_id}',params={'user_id':3}).status_code==404
    assert client.patch(f'/api/documents/{document_id}',json={'user_id':2,'title':'Edited by Leen'}).status_code==200
    assert client.get(f'/api/documents/{document_id}',params={'user_id':1}).json()['title']=='Edited by Leen'


def test_import_validation_and_persistence(tmp_path):
    path = tmp_path / 'test.db'
    client = TestClient(create_app(str(path)))
    bad = client.post('/api/import',data={'user_id':1},files={'file':('example.exe',b'x','application/octet-stream')})
    assert bad.status_code == 415
    result = client.post('/api/import',data={'user_id':1},files={'file':('notes.txt',b'One\nTwo','text/plain')})
    assert result.status_code == 201
    document_id = result.json()['id']
    assert 'One<br>Two' in client.get(f'/api/documents/{document_id}',params={'user_id':1}).json()['content']
    restarted = TestClient(create_app(str(path)))
    assert restarted.get(f'/api/documents/{document_id}',params={'user_id':1}).status_code==200


def test_view_only_permissions_revoke_and_image_safety(tmp_path):
    client = TestClient(create_app(str(tmp_path / 'roles.db')))
    created = client.post('/api/documents', json={'user_id':1,'title':'Shared thoughts'}).json()
    doc_id = created['id']
    assert client.post(f'/api/documents/{doc_id}/share', json={'user_id':1,'target_user_id':2,'role':'view'}).status_code == 201
    doc = client.get(f'/api/documents/{doc_id}',params={'user_id':2}).json()
    assert doc['role'] == 'view'
    assert client.patch(f'/api/documents/{doc_id}',json={'user_id':2,'title':'unauthorized'}).status_code == 403
    assert client.patch(f'/api/documents/{doc_id}',json={'user_id':1,'content':'<img src="https://evil.example/a.png" onerror="alert(1)"><img src="data:image/png;base64,aGVsbG8=" alt="safe">'}).status_code == 200
    content=client.get(f'/api/documents/{doc_id}',params={'user_id':1}).json()['content']
    assert 'onerror' not in content and 'evil.example' not in content
    assert 'data:image/png;base64,aGVsbG8=' in content
    assert client.post(f'/api/documents/{doc_id}/share',json={'user_id':1,'target_user_id':2,'role':'edit'}).status_code == 201
    assert client.patch(f'/api/documents/{doc_id}',json={'user_id':2,'title':'allowed'}).status_code == 200
    assert client.delete(f'/api/documents/{doc_id}/share/2?user_id=1').status_code == 200
    assert client.get(f'/api/documents/{doc_id}',params={'user_id':2}).status_code == 404


def test_image_dimensions_and_alignment_survive_sanitization(tmp_path):
    client = TestClient(create_app(str(tmp_path / 'img.db')))
    doc_id = client.post('/api/documents',json={'user_id':1,'title':'Image test'}).json()['id']
    content = '<figure data-align="right"><img width="460" alt="photo" src="data:image/png;base64,aGVsbG8="></figure>'
    assert client.patch(f'/api/documents/{doc_id}',json={'user_id':1,'content':content}).status_code==200
    result=client.get(f'/api/documents/{doc_id}',params={'user_id':1}).json()['content']
    assert '<figure data-align="right">' in result
    assert 'width="460"' in result
    blocked='<figure data-align="nonsense"><img width="999999" src="data:image/png;base64,aGVsbG8="></figure>'
    client.patch(f'/api/documents/{doc_id}',json={'user_id':1,'content':blocked})
    result=client.get(f'/api/documents/{doc_id}',params={'user_id':1}).json()['content']
    assert 'nonsense' not in result and '999999' not in result


def test_demo_users_and_version_history(tmp_path):
    path = tmp_path / 'version.db'
    client = TestClient(create_app(str(path)))
    assert [u['name'] for u in client.get('/api/users').json()] == ['Ruth','Leen','Arden']
    doc = client.post('/api/documents',json={'user_id':1,'title':'Draft 1'}).json()['id']
    client.patch(f'/api/documents/{doc}',json={'user_id':1,'content':'<p>First version</p>'})
    ver1 = client.post(f'/api/documents/{doc}/versions',params={'user_id':1})
    assert ver1.status_code == 201 and ver1.json()['created']
    assert client.post(f'/api/documents/{doc}/versions',params={'user_id':1}).json()['created'] is False
    client.patch(f'/api/documents/{doc}',json={'user_id':1,'title':'Draft 2','content':'<p>Second version</p>'})
    ver2 = client.post(f'/api/documents/{doc}/versions',params={'user_id':1})
    assert ver2.json()['created']
    versions = client.get(f'/api/documents/{doc}/versions',params={'user_id':1}).json()
    assert [v['title'] for v in versions] == ['Draft 2','Draft 1']
    assert all('content' not in v for v in versions)
    assert client.get(f'/api/documents/{doc}/versions',params={'user_id':2}).status_code == 404
    client.post(f'/api/documents/{doc}/share',json={'user_id':1,'target_user_id':2,'role':'view'})
    assert client.get(f'/api/documents/{doc}/versions',params={'user_id':2}).status_code == 200
    assert client.post(f'/api/documents/{doc}/versions',params={'user_id':2}).status_code == 403
    assert client.post(f'/api/documents/{doc}/versions/{ver1.json()["id"]}/restore',params={'user_id':2}).status_code == 403
    assert client.post(f'/api/documents/{doc}/versions/999999/restore',params={'user_id':1}).status_code == 404
    restored = client.post(f'/api/documents/{doc}/versions/{ver1.json()["id"]}/restore',params={'user_id':1})
    assert restored.json()['restored'] is True
    final = client.get(f'/api/documents/{doc}',params={'user_id':1}).json()
    assert final['title']=='Draft 1' and 'First version' in final['content']
    # Current draft was snapshotted before restore, and data survives app restart.
    assert any(v['title']=='Draft 2' for v in client.get(f'/api/documents/{doc}/versions',params={'user_id':1}).json())
    restart = TestClient(create_app(str(path)))
    assert restart.get(f'/api/documents/{doc}/versions',params={'user_id':1}).status_code == 200
    assert [u['name'] for u in restart.get('/api/users').json()] == ['Ruth','Leen','Arden']


def test_migrates_old_demo_user_names(tmp_path):
    import sqlite3
    path = tmp_path / 'old.db'
    TestClient(create_app(str(path)))
    with sqlite3.connect(path) as db:
        db.execute("UPDATE users SET name='Ava' WHERE id=2")
        db.execute("UPDATE users SET name='Noah' WHERE id=3")
    restarted = TestClient(create_app(str(path)))
    assert [u['name'] for u in restarted.get('/api/users').json()] == ['Ruth','Leen','Arden']

def test_landing_has_no_seed_and_preserves_modified_user_documents(tmp_path):
    import sqlite3
    dbpath = tmp_path / 'old-seed.db'
    client = TestClient(create_app(str(dbpath)))
    assert client.get('/api/documents', params={'user_id': 1}).json() == []
    old = '<h2>Field Notes</h2><p>An observation is not yet an explanation.</p><p>Begin with what you know. Mark what you assume. Return to what remains uncertain.</p>'
    with sqlite3.connect(dbpath) as db:
        db.execute('INSERT INTO documents(owner_id,title,content) VALUES (1,?,?)', ('Field Notes', old))
        db.execute('INSERT INTO documents(owner_id,title,content) VALUES (1,?,?)', ('My real notes','<p>Preserved</p>'))
    reloaded = TestClient(create_app(str(dbpath)))
    names = [r['title'] for r in reloaded.get('/api/documents', params={'user_id': 1}).json()]
    assert names == ['My real notes']
