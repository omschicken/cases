"""Blender Text Editor > Open > this file > Run Script.
Strict preflight for the workshop. Writes a report even when export is refused.
Does not invent meshes, clips or textures. Does not overwrite an existing GLB.
"""
import bpy
import json
import math
from pathlib import Path

PARTS = ['CaseBody', 'CaseLid', 'LockLeft', 'LockRight', 'Hinge', 'RavenRelief', 'Logo', 'Interior']
CLIPS = ['Fly', 'Landing', 'Idle', 'Takeoff', 'FlyAway']

def descendants(root):
    return [root, *root.children_recursive] if root else []

def image_upstream(socket, seen=None):
    seen = seen or set()
    for link in socket.links:
        node = link.from_node
        if node in seen: continue
        seen.add(node)
        if node.type == 'TEX_IMAGE' and node.image and node.image.has_data: return True
        if any(image_upstream(s, seen) for s in node.inputs if s.is_linked): return True
    return False

def preflight(kind):
    root = bpy.data.objects.get('RavenCase' if kind == 'case' else 'RavenBird')
    errors = []
    objects = descendants(root)
    meshes = [o for o in objects if o.type == 'MESH']
    if not root: errors.append('Root object missing')
    if not root or root.get('visualApproved') is not True:
        errors.append('Visual approval absent: root custom property visualApproved must be a Boolean true after human art review')
    if not meshes: errors.append('No mesh geometry')
    if kind == 'case':
        for name in PARTS:
            part = bpy.data.objects.get(name)
            if part not in objects or not any(o.type == 'MESH' and len(o.data.polygons) for o in descendants(part)):
                errors.append(name + ': actual mesh missing (empty marker is not a finished part)')
        lid = bpy.data.objects.get('CaseLid')
        if lid and (lid.location - __import__('mathutils').Vector((0, .8, 1))).length > .01:
            errors.append('CaseLid local pivot must be Blender (0,.8,1) at the rear hinge')
    else:
        rigs = [o for o in objects if o.type == 'ARMATURE']
        if not rigs: errors.append('Bird skeleton missing')
        if not any(o.vertex_groups and any(m.type == 'ARMATURE' and m.object in rigs for m in o.modifiers) for o in meshes):
            errors.append('Bird skinning/weights missing')
        actions = []
        for rig in rigs:
            if not rig.animation_data: continue
            if rig.animation_data.action: actions.append((rig.animation_data.action.name, rig.animation_data.action))
            for track in rig.animation_data.nla_tracks:
                for strip in track.strips:
                    if strip.action: actions.append((track.name, strip.action))
        for name in CLIPS:
            if not any(n == name and a.fcurves and any(f.data_path.startswith('pose.bones') and len(f.keyframe_points) > 1 for f in a.fcurves) for n, a in actions):
                errors.append(name + ': bound skeletal action with real keyframes missing')
    triangles = 0
    for obj in meshes:
        if not obj.data.uv_layers: errors.append(obj.name + ': UV missing')
        if any(abs(s - 1) > .001 for s in obj.scale): errors.append(obj.name + ': apply scale before export')
        if not obj.data.materials: errors.append(obj.name + ': material missing')
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh(); mesh.calc_loop_triangles(); triangles += len(mesh.loop_triangles); evaluated.to_mesh_clear()
    for mat in {m for o in meshes for m in o.data.materials if m}:
        p = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if mat.use_nodes else None
        if not p: errors.append(mat.name + ': Principled material required'); continue
        channels = ['Base Color', 'Roughness', 'Normal']
        if kind == 'case' and 'Steel' in mat.name: channels.append('Metallic')
        for channel in channels:
            if not image_upstream(p.inputs[channel]): errors.append(mat.name + ': baked image map missing for ' + channel)
    limit = 70000 if kind == 'case' else 80000
    if triangles > limit: errors.append(f'Triangle count {triangles} exceeds desktop budget {limit}')
    return {'kind': kind, 'status': 'PASS_TECHNICAL_ONLY' if not errors else 'BLOCKED', 'trianglesEvaluated': triangles, 'meshObjects': len(meshes), 'errors': errors}, root

def run():
    scene = bpy.context.scene
    scene.frame_set(1)
    folder = Path(bpy.path.abspath('//exports'))
    folder.mkdir(parents=True, exist_ok=True)
    reports = []
    for kind, filename in [('case', 'RavenCase.glb'), ('bird', 'RavenBird.glb')]:
        report, root = preflight(kind)
        target = folder / filename
        if target.exists(): report['errors'].append('Existing GLB preserved: move it to a revision folder before exporting again'); report['status'] = 'BLOCKED'
        reports.append(report)
        if report['errors']: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in descendants(root): o.select_set(True)
        bpy.context.view_layer.objects.active = root
        bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLB', use_selection=True,
            export_yup=True, export_apply=True, export_animations=kind == 'bird',
            export_animation_mode='ACTIONS', export_extras=True, export_cameras=False, export_lights=False)
        report['file'] = filename
    (folder / 'preflight.json').write_text(json.dumps(reports, indent=2), encoding='utf-8')
    print(json.dumps(reports, indent=2))
    if any(r['errors'] for r in reports):
        print('EXPORT BLOCKED: see exports/preflight.json. Workshop is not final art.')
    return reports

if __name__ == '__main__': run()
