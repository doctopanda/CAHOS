import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import servidor as s

CATALOG = {
    'pathologies': [{'id':'[Padecimientos].[Padecimiento].&[A1]', 'nombre':'Dengue'}],
    'years': [{'id':f'[Años].[Año].&[{i}]','nombre':str(i)} for i in range(2019,2027)],
    'weeks': [{'id':f'[Semanas epidemiológicas].[Semana].&[{i}]','nombre':f'Semana {i:02d}'} for i in range(1,54)],
    'municipalities': [{'id':'[Municipios].[Municipio].&[300]','nombre':'Hermosillo'}],
    'entities': [{'id':'[Entidades].[Entidad].&[26]','nombre':'Sonora'}],
    'sex': [{'id':'[Sexo].[Sexo].&[1]','nombre':'Hombre'}, {'id':'[Sexo].[Sexo].&[2]','nombre':'Mujer'}],
    'age': [{'id':'[Grupos de edades].[Grupo de edad].&[1]','nombre':'Menor de 1'}],
}

class MDXTests(unittest.TestCase):
    def setUp(self):
        self.patcher=patch.object(s,'get_catalog',side_effect=lambda dim,force=False: CATALOG[dim]);self.patcher.start()
        self.req={'pathology':CATALOG['pathologies'][0]['id'],'years':[CATALOG['years'][-1]['id']],
                  'entity':CATALOG['entities'][0]['id'],'municipality':CATALOG['municipalities'][0]['id']}
    def tearDown(self):
        self.patcher.stop()
    def test_prevent_injection(self):
        self.assertFalse(s.canonical_member('[Padecimientos].[Padecimiento].&[x];DROP CUBE'))
        with self.assertRaises(ValueError):s.build_mdx({**self.req,'kind':'weekly','pathology':'[Padecimientos].[Padecimiento].&[x];DROP'})
    def test_weekly_filtered(self):
        mdx, axes=s.build_mdx({**self.req,'kind':'weekly','week_start':1,'week_end':5})
        self.assertEqual(axes,['years','weeks'])
        self.assertIn('CROSSJOIN',mdx)
        self.assertIn('[Semana].&[5]',mdx)
        self.assertNotIn('[Semana].&[6]',mdx)
        self.assertIn('WHERE ([Padecimientos]',mdx)
        self.assertTrue(mdx.startswith('SELECT'))
    def test_annual(self):
        mdx,axes=s.build_mdx({**self.req,'kind':'annual'})
        self.assertEqual(axes,['years'])
        self.assertIn('[Measures].[Casos]',mdx)
    def test_sex_no_total(self):
        mdx,axes=s.build_mdx({**self.req,'kind':'sex'})
        self.assertEqual(axes,['sex'])
        self.assertIn('[Sexo].[Sexo].&[1]',mdx)
        self.assertNotIn('[Sexo].[Sexo].MEMBERS',mdx)
    def test_no_unknown_member(self):
        with self.assertRaises(ValueError):s.build_mdx({**self.req,'kind':'annual','municipality':'[Municipios].[Municipio].&[nada]'})
    def test_flatten(self):
        res={'columns':['[Años].[Año].[MEMBER_CAPTION]','[Semanas epidemiológicas].[Semana].[MEMBER_CAPTION]','[Measures].[Casos]'],
             'rows':[['2026','Semana 01',4],['2026','Semana 02',None]]}
        rows=s.normalise_flat_response(res,['years','weeks'])
        self.assertEqual(rows,[{'years':'2026','weeks':'Semana 01','cases':4.0},{'years':'2026','weeks':'Semana 02','cases':None}])
    def test_members(self):
        res={'columns':['HIERARCHY_UNIQUE_NAME','MEMBER_UNIQUE_NAME','MEMBER_CAPTION','MEMBER_TYPE'],
             'rows':[['[Años].[Año]','[Años].[Año].&[2026]','2026',1],['[Años].[Año]','[Años].[Año].[All]','Todos',2]]}
        self.assertEqual(len(s.members_from_response(res,'[Años].[Año]')),1)

if __name__=='__main__':unittest.main()
