using UnityEditor;
using UnityEngine;

namespace BeastTamer.EditorTools
{
    /// <summary>
    /// Web prototipinden (npm run art:export-unity) aktarılan görsellerin import ayarlarını
    /// otomatik yapar. Assets/BeastTamer/Art/ altına düşen her PNG UI Sprite olarak gelir.
    /// Kart çerçevesi, isim, sayılar görselde yoktur; bunlar kart prefab'ında UI ile kurulur.
    /// </summary>
    public class BeastTamerArtPostprocessor : AssetPostprocessor
    {
        const string Root = "Assets/BeastTamer/Art/";

        void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith(Root)) return;

            var importer = (TextureImporter)assetImporter;
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.sRGBTexture = true;
            importer.filterMode = FilterMode.Bilinear;
            importer.textureCompression = TextureImporterCompression.CompressedHQ;
            importer.maxTextureSize = assetPath.Contains("/Weather/") ? 2048 : 1024;
        }
    }
}
