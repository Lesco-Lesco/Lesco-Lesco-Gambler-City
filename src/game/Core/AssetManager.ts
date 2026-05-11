/**
 * AssetManager — handles loading of textures and sprites for the Remastered visuals.
 */

export class AssetManager {
    private static images: Map<string, HTMLImageElement> = new Map();
    private static loadingPromise: Promise<void> | null = null;

    private static ASSET_PATHS = {
        'asphalt': '/assets/remaster/ground_asphalt.png',
        'sidewalk': '/assets/remaster/ground_sidewalk.png',
        'casa_laje': '/assets/remaster/building_casa_laje.png',
        'brick_wall': '/assets/remaster/building_brick_wall.png',
        'noble_asphalt': '/assets/remaster/ground_asphalt_noble.png',
        'noble_sidewalk': '/assets/remaster/ground_sidewalk_noble.png',
        'noble_building': '/assets/remaster/building_noble.png',
    };

    public static async loadAll(): Promise<void> {
        if (this.loadingPromise) return this.loadingPromise;

        const promises = Object.entries(this.ASSET_PATHS).map(([key, path]) => {
            return new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images.set(key, img);
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to load asset: ${path}`);
                    resolve(); // Resolve anyway to not block
                };
                img.src = path;
            });
        });

        this.loadingPromise = Promise.all(promises).then(() => {});
        return this.loadingPromise;
    }

    public static getImage(key: string): HTMLImageElement | undefined {
        return this.images.get(key);
    }

    public static isLoaded(): boolean {
        return this.images.size > 0;
    }
}
