import { db } from 'api/src/lib/db'
import { getRelease } from 'api/src/lib/discogs'

export default async ({ args }) => {
  // Your script here...
  console.log(':: Executing script with args ::')
  console.log(args)

  const page = Math.max(args.page || 1, 1) // Ensure page is at least 1
  const perPage = Math.max(args.perPage || 10, 1) // Ensure perPage is at least 1
  const take = perPage
  let skip = (page - 1) * perPage
  let count = -1

  while (count !== 0) {
    const releases = await db.release.findMany({
      where: {
        status: 'Accepted',
      },
      orderBy: {
        discogsId: 'asc',
      },
      include: {
        artist: true,
        label: true,
      },
      take,
      skip,
    })

    if (releases.length === 0) break // Exit loop if no more releases

    for (const release of releases) {
      console.log('>>> fetching release', release.title)

      const response = await getRelease(release.discogsId)
      const {
        // id,
        title,
        // data_quality,
        thumb,
        images,
        uri,
        notes,
        styles,
        genres,
      } = response

      await db.release.update({
        where: {
          id: release.id,
        },
        data: {
          title,
          notes,
          thumbnail: thumb,
        },
      })

      console.log('>>> updating release', title)

      await db.release.update({
        where: {
          id: release.id,
        },
        data: {
          uri,
          notes,
        },
      })

      styles?.forEach(async (style) => {
        await db.release.update({
          where: {
            id: release.id,
          },
          data: {
            style: {
              connectOrCreate: {
                where: {
                  name: style,
                },
                create: {
                  name: style,
                },
              },
            },
          },
        })
      })

      genres?.forEach(async (genre) => {
        await db.release.update({
          where: {
            id: release.id,
          },
          data: {
            genre: {
              connectOrCreate: {
                where: {
                  name: genre,
                },
                create: {
                  name: genre,
                },
              },
            },
          },
        })
      })

      images?.forEach(async (image) => {
        console.log(
          '>>> updating image',
          image.uri,
          image.type,
          release.id,
          release.title
        )
        await db.image.upsert({
          where: {
            uri: image.uri,
          },
          update: {
            uri: image.uri,
            type: image.type,
            width: image.width,
            height: image.height,
            resourceUrl: image.resource_url,
            uri150: image.uri150,
            release: {
              connect: {
                id: release.id,
              },
            },
          },
          create: {
            uri: image.uri,
            type: image.type,
            width: image.width,
            height: image.height,
            resourceUrl: image.resource_url,
            uri150: image.uri150,
            release: {
              connect: {
                id: release.id,
              },
            },
          },
        })
      })

      // pause for a bit
      await new Promise((resolve) => setTimeout(resolve, 750))
    }

    skip += take
    count = releases.length
  }
}
