import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TwinProfile } from '../services/geminiService';
import { motion } from 'motion/react';
import { Maximize2, Minimize2, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  group: 'center' | 'category' | 'item';
  label: string;
  type?: string;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string;
  target: string;
  value: number;
}

interface KnowledgeGraphProps {
  profile: TwinProfile;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ profile }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: isFullscreen ? window.innerHeight - 100 : 500
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isFullscreen]);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Prepare data
    const nodes: Node[] = [
      { id: 'center', group: 'center', label: 'My Identity' }
    ];
    const links: Link[] = [];

    const categories = [
      { id: 'interests', label: 'Interests', data: profile.learnedTraits?.topicInterests || [] },
      { id: 'goals', label: 'Goals', data: profile.goals || [] },
      { id: 'facts', label: 'Key Facts', data: profile.knowledge || [] },
      { id: 'traits', label: 'Traits', data: [
        ...(profile.learnedTraits?.strengths || []),
        ...(profile.learnedTraits?.behaviorTraits || [])
      ]}
    ];

    categories.forEach(cat => {
      if (cat.data.length > 0) {
        nodes.push({ id: cat.id, group: 'category', label: cat.label });
        links.push({ source: 'center', target: cat.id, value: 2 });

        cat.data.forEach((item, i) => {
          const itemId = `${cat.id}-${i}`;
          nodes.push({ id: itemId, group: 'item', label: item, type: cat.id });
          links.push({ source: cat.id, target: itemId, value: 1 });
        });
      }
    });

    // Add memory nodes if available
    if (profile.memory && profile.memory.length > 0) {
      nodes.push({ id: 'memories', group: 'category', label: 'Memories' });
      links.push({ source: 'center', target: 'memories', value: 2 });
      
      profile.memory.slice(0, 10).forEach((mem, i) => {
        const itemId = `mem-${i}`;
        nodes.push({ id: itemId, group: 'item', label: mem.text.slice(0, 30) + '...', type: 'memory' });
        links.push({ source: 'memories', target: itemId, value: 1 });
      });
    }

    const simulation = d3.forceSimulation<Node>(nodes)
      .force('link', d3.forceLink<Node, Link>(links).id(d => d.id).distance(d => d.value === 2 ? 100 : 60))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const link = g.append('g')
      .attr('stroke', 'rgba(255, 255, 255, 0.1)')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.value) * 2);

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    node.append('circle')
      .attr('r', d => d.group === 'center' ? 15 : d.group === 'category' ? 10 : 6)
      .attr('fill', d => {
        if (d.group === 'center') return '#6366f1'; // Indigo
        if (d.group === 'category') return '#ec4899'; // Pink
        return '#94a3b8'; // Slate
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    node.append('text')
      .text(d => d.label)
      .attr('x', 12)
      .attr('y', 4)
      .attr('fill', '#fff')
      .attr('font-size', d => d.group === 'center' ? '14px' : '10px')
      .attr('font-weight', d => d.group === 'center' ? 'bold' : 'normal')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.5)');

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fys = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => { simulation.stop(); };
  }, [dimensions, profile]);

  return (
    <div 
      ref={containerRef} 
      className={`relative bg-slate-900/50 rounded-[32px] border border-white/5 overflow-hidden transition-all duration-500 ${isFullscreen ? 'fixed inset-0 z-50 m-4' : 'w-full h-[500px]'}`}
    >
      <div className="absolute top-6 left-6 z-10">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Brain className="text-primary" />
          Neural Brain Map
        </h3>
        <p className="text-xs text-slate-400">Interactive visualization of your digital twin's knowledge base.</p>
      </div>

      <div className="absolute top-6 right-6 z-10 flex gap-2">
        <button 
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all"
          title={isFullscreen ? "Minimize" : "Maximize"}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      <svg 
        ref={svgRef} 
        width="100%" 
        height="100%" 
        className="cursor-grab active:cursor-grabbing"
      />

      <div className="absolute bottom-6 left-6 z-10 flex gap-4 text-[10px] uppercase tracking-widest font-bold text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500" />
          Identity
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-pink-500" />
          Category
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          Knowledge
        </div>
      </div>
    </div>
  );
};

const Brain = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.54Z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.54Z"/>
  </svg>
);
