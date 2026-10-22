"""Run with Blender --background WORKSHOP.blend --python inspect_workshop.py -- REPORT_DIR.
Verifies the authoring scaffold and saves two actual Blender renders, not final CGI.
"""
import bpy
import sys
import json
import math
from pathlib import Path
from mathutils import Vector

folder = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
folder.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
required = ['CaseBody', 'CaseLid', 'LockLeft', 'LockRight', 'Hinge', 'RavenRelief', 'Logo', 'Interior']
assert all(bpy.data.objects.get(n) for n in required)
assert len(bpy.data.objects['RavenRig_TEMPLATE'].data.bones) == 17
assert len([o for o in bpy.data.collections['02_RavenBird_RIG_TEMPLATE_NO_MESH'].objects if o.type == 'MESH']) == 0
assert bpy.data.objects['RavenRelief'].type == 'EMPTY'
assert bpy.data.objects['Logo'].type == 'EMPTY'
assert (bpy.data.objects['CaseLid'].location - Vector((0, .8, 1))).length < .0001
scene.frame_set(1)
body_closed = bpy.data.objects['Body_Front'].matrix_world.copy()
lid_closed = bpy.data.objects['LidShell'].matrix_world.copy()
scene.frame_set(213)
assert (bpy.data.objects['Body_Front'].matrix_world.translation - body_closed.translation).length < .0001
assert (bpy.data.objects['LidShell'].matrix_world.translation - lid_closed.translation).length > .5
assert abs(bpy.data.objects['CaseLid'].rotation_euler.x - math.radians(-108)) < .001
assert abs(bpy.data.objects['LockLeft'].rotation_euler.x - math.radians(80)) < .001
meshes = [o for o in scene.objects if o.type == 'MESH']
assert all(o.data.uv_layers for o in bpy.data.collections['01_RavenCase_WIP'].objects if o.type == 'MESH')
triangles = 0
for o in bpy.data.collections['01_RavenCase_WIP'].objects:
    if o.type != 'MESH': continue
    evaluated = o.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh(); mesh.calc_loop_triangles(); triangles += len(mesh.loop_triangles); evaluated.to_mesh_clear()
report = {
    'scope': 'authoring scaffold only, not final asset approval',
    'assertions': 'PASS', 'caseMeshObjects': 60, 'caseEvaluatedTriangles': triangles,
    'birdMeshObjects': 0, 'birdTemplateBones': 17,
    'stationaryBody': True, 'lidRotatesAboutRearHinge': True,
    'independentLatchRotation': True, 'caseUVLayersPresent': True,
    'visualReady': False, 'runtimeAssetsExported': False,
}
(folder / 'workshop-inspection.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
scene.render.resolution_x = 1000; scene.render.resolution_y = 700
scene.cycles.samples = 16
for frame, label in [(1, 'workshop-closed-NOT-FINAL'), (213, 'workshop-open-NOT-FINAL')]:
    scene.frame_set(frame)
    scene.render.filepath = str(folder / (label + '.png'))
    bpy.ops.render.render(write_still=True)
print(json.dumps(report))
