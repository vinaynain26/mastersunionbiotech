import VideoScrollExperience from '@/components/VideoScrollExperience'

export default function Home() {
  return (
    <main style={{ margin: 0, padding: 0 }}>
      <VideoScrollExperience
        frameCount={121}
        folderPath="/frames"
        extension="webp"
        gates={[25, 55, 85, 110]}   // Adjust these as needed
        labels={[
          { title: 'Act One', sub: 'Scroll to begin the journey' },
          { title: 'The Shift', sub: 'Something is changing' },
          { title: 'The Turn', sub: 'There is no going back now' },
          { title: 'The End', sub: 'Everything leads here' },
        ]}
      />
    </main>
  )
}